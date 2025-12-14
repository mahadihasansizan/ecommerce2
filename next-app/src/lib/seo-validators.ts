/**
 * SEO Validation Utilities
 * Functions to validate SEO metadata, structured data, and other SEO elements
 */

/**
 * Validate meta title
 * Should be 50-60 characters for optimal SEO
 */
export const validateTitle = (title: string): { valid: boolean; message?: string } => {
  if (!title || title.trim().length === 0) {
    return { valid: false, message: 'Title is required' };
  }
  
  if (title.length < 30) {
    return { valid: false, message: 'Title is too short (recommended: 50-60 characters)' };
  }
  
  if (title.length > 60) {
    return { valid: false, message: 'Title is too long (recommended: 50-60 characters)' };
  }
  
  return { valid: true };
};

/**
 * Validate meta description
 * Should be 120-160 characters for optimal SEO
 */
export const validateDescription = (description: string): { valid: boolean; message?: string } => {
  if (!description || description.trim().length === 0) {
    return { valid: false, message: 'Description is required' };
  }
  
  if (description.length < 120) {
    return { valid: false, message: 'Description is too short (recommended: 120-160 characters)' };
  }
  
  if (description.length > 160) {
    return { valid: false, message: 'Description is too long (recommended: 120-160 characters)' };
  }
  
  return { valid: true };
};

/**
 * Validate canonical URL
 * Should be absolute and match the current page
 */
export const validateCanonical = (canonical: string, currentUrl: string): { valid: boolean; message?: string } => {
  if (!canonical) {
    return { valid: false, message: 'Canonical URL is required' };
  }
  
  if (!canonical.startsWith('http://') && !canonical.startsWith('https://')) {
    return { valid: false, message: 'Canonical URL must be absolute (include https://)' };
  }
  
  // Canonical should match the base URL of current page (without query params)
  const canonicalBase = canonical.split('?')[0].split('#')[0];
  const currentBase = currentUrl.split('?')[0].split('#')[0];
  
  if (canonicalBase !== currentBase && !canonicalBase.includes(currentBase)) {
    return { valid: true, message: 'Canonical URL differs from current URL (this may be intentional)' };
  }
  
  return { valid: true };
};

/**
 * Validate structured data (JSON-LD)
 * Checks for required fields based on schema type
 */
export const validateStructuredData = (data: Record<string, any>): { valid: boolean; message?: string; errors?: string[] } => {
  const errors: string[] = [];
  
  if (!data['@context'] || !data['@type']) {
    errors.push('Missing @context or @type');
    return { valid: false, message: 'Invalid structured data format', errors };
  }
  
  const schemaType = data['@type'];
  
  // Validate Product schema
  if (schemaType === 'Product') {
    if (!data.name) errors.push('Product schema missing "name"');
    if (!data.image || (Array.isArray(data.image) && data.image.length === 0)) {
      errors.push('Product schema missing "image"');
    }
    if (!data.offers) {
      errors.push('Product schema missing "offers"');
    } else {
      if (!data.offers.price) errors.push('Product offers missing "price"');
      if (!data.offers.priceCurrency) errors.push('Product offers missing "priceCurrency"');
      if (!data.offers.availability) errors.push('Product offers missing "availability"');
    }
  }
  
  // Validate BreadcrumbList schema
  if (schemaType === 'BreadcrumbList') {
    if (!data.itemListElement || !Array.isArray(data.itemListElement)) {
      errors.push('BreadcrumbList schema missing "itemListElement" array');
    }
  }
  
  // Validate Website schema
  if (schemaType === 'Website') {
    if (!data.name) errors.push('Website schema missing "name"');
    if (!data.url) errors.push('Website schema missing "url"');
  }
  
  // Validate Organization schema
  if (schemaType === 'Organization') {
    if (!data.name) errors.push('Organization schema missing "name"');
    if (!data.url) errors.push('Organization schema missing "url"');
  }
  
  return {
    valid: errors.length === 0,
    message: errors.length > 0 ? `Structured data validation failed: ${errors.join(', ')}` : undefined,
    errors: errors.length > 0 ? errors : undefined,
  };
};

/**
 * Validate image alt text
 */
export const validateImageAlt = (alt: string, imageSrc: string): { valid: boolean; message?: string } => {
  if (!alt || alt.trim().length === 0) {
    return { valid: false, message: `Image ${imageSrc} is missing alt text` };
  }
  
  if (alt.length < 5) {
    return { valid: false, message: `Image alt text is too short: "${alt}"` };
  }
  
  // Check for generic alt text
  const genericAlts = ['image', 'img', 'photo', 'picture', 'photo1', 'img1'];
  if (genericAlts.includes(alt.toLowerCase())) {
    return { valid: false, message: `Image has generic alt text: "${alt}"` };
  }
  
  return { valid: true };
};

/**
 * Comprehensive SEO validation for a page
 */
export interface SEOValidationResult {
  title: { valid: boolean; message?: string };
  description: { valid: boolean; message?: string };
  canonical: { valid: boolean; message?: string };
  structuredData: Array<{ valid: boolean; message?: string; errors?: string[] }>;
  images: Array<{ valid: boolean; message?: string }>;
  overall: { valid: boolean; score: number; issues: string[] };
}

export const validatePageSEO = (data: {
  title?: string;
  description?: string;
  canonical?: string;
  currentUrl: string;
  structuredData?: Array<Record<string, any>>;
  images?: Array<{ alt?: string; src: string }>;
}): SEOValidationResult => {
  const issues: string[] = [];
  let score = 100;
  
  // Validate title
  const titleValidation = data.title ? validateTitle(data.title) : { valid: false, message: 'Title is missing' };
  if (!titleValidation.valid) {
    issues.push(`Title: ${titleValidation.message}`);
    score -= 20;
  }
  
  // Validate description
  const descValidation = data.description ? validateDescription(data.description) : { valid: false, message: 'Description is missing' };
  if (!descValidation.valid) {
    issues.push(`Description: ${descValidation.message}`);
    score -= 20;
  }
  
  // Validate canonical
  const canonicalValidation = data.canonical 
    ? validateCanonical(data.canonical, data.currentUrl)
    : { valid: false, message: 'Canonical URL is missing' };
  if (!canonicalValidation.valid) {
    issues.push(`Canonical: ${canonicalValidation.message}`);
    score -= 15;
  }
  
  // Validate structured data
  const structuredDataValidations = (data.structuredData || []).map(sd => validateStructuredData(sd));
  structuredDataValidations.forEach((validation, index) => {
    if (!validation.valid) {
      issues.push(`Structured Data ${index + 1}: ${validation.message}`);
      score -= 10;
    }
  });
  
  // Validate images
  const imageValidations = (data.images || []).map(img => 
    validateImageAlt(img.alt || '', img.src)
  );
  imageValidations.forEach((validation, index) => {
    if (!validation.valid) {
      issues.push(`Image ${index + 1}: ${validation.message}`);
      score -= 5;
    }
  });
  
  return {
    title: titleValidation,
    description: descValidation,
    canonical: canonicalValidation,
    structuredData: structuredDataValidations,
    images: imageValidations,
    overall: {
      valid: score >= 70,
      score: Math.max(0, score),
      issues,
    },
  };
};

