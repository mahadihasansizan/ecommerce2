import axios from 'axios';

/**
 * Headless Proxy Manager Integration Hook
 * Use this in your React components to interact with all proxy endpoints
 */

export const useHeadlessProxy = () => {
  const baseProxyUrl = process.env.VITE_WP_PROXY_BASE_URL || 'http://localhost:3000/wp-json/headless-proxy/v1';
  const kitchenHeroUrl = (process.env.VITE_WP_PROXY_BASE_URL || '').replace('/headless-proxy/v1', '/kitchenhero/v1') || 'http://localhost:3000/wp-json/kitchenhero/v1';
  const reviewsUrl = baseProxyUrl.replace('/headless-proxy/v1', '/msds_headless_custom_review/v1');
  const proxySecret = process.env.VITE_WP_ORDER_PROXY_SECRET || '';

  const axiosInstance = axios.create({
    timeout: 15000,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }
  });

  // ========================================================================
  // ABANDONED CARTS
  // ========================================================================

  const trackAbandonedCart = async (cartData) => {
    try {
      const response = await axiosInstance.post(`${kitchenHeroUrl}/abandoned-cart`, {
        name: cartData.name,
        email: cartData.email,
        phone: cartData.phone,
        address: cartData.address,
        state: cartData.state,
        cartItems: cartData.items?.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          productId: item.id
        })) || []
      });
      return response.data;
    } catch (error) {
      console.error('Error tracking abandoned cart:', error);
      throw error;
    }
  };

  const markCartCompleted = async (phone) => {
    try {
      const response = await axiosInstance.post(`${kitchenHeroUrl}/abandoned-cart/mark-completed`, {
        phone
      });
      return response.data;
    } catch (error) {
      console.error('Error marking cart completed:', error);
      throw error;
    }
  };

  // ========================================================================
  // CONTACT FORM
  // ========================================================================

  const submitContact = async (contactData) => {
    try {
      const response = await axiosInstance.post(`${kitchenHeroUrl}/contact`, {
        name: contactData.name,
        email: contactData.email,
        phone: contactData.phone,
        subject: contactData.subject,
        message: contactData.message
      });
      return response.data;
    } catch (error) {
      console.error('Error submitting contact form:', error);
      throw error;
    }
  };

  // ========================================================================
  // PHONE SUBSCRIPTIONS
  // ========================================================================

  const subscribePhone = async (phone) => {
    try {
      const response = await axiosInstance.post(`${kitchenHeroUrl}/phone-subscription`, {
        phone
      });
      return response.data;
    } catch (error) {
      console.error('Error subscribing phone:', error);
      throw error;
    }
  };

  // ========================================================================
  // CUSTOM LABELS
  // ========================================================================

  const getProductLabels = async (productId) => {
    try {
      const response = await axiosInstance.get(`${baseProxyUrl}/custom-labels`, {
        params: { product_id: productId }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching labels:', error);
      return { labels: [] };
    }
  };

  // ========================================================================
  // PRODUCT FAQs
  // ========================================================================

  const getProductFAQs = async (productId) => {
    try {
      const response = await axiosInstance.get(`${baseProxyUrl}/faqs`, {
        params: { product_id: productId }
      });
      return response.data?.faqs || response.data || [];
    } catch (error) {
      console.error('Error fetching FAQs:', error);
      return [];
    }
  };

  // ========================================================================
  // PRODUCT REVIEWS
  // ========================================================================

  const getProductReviews = async (productId) => {
    try {
      const response = await axiosInstance.get(`${reviewsUrl}/reviews`, {
        params: { product_id: productId }
      });
      return response.data || [];
    } catch (error) {
      console.error('Error fetching reviews:', error);
      return [];
    }
  };

  const submitProductReview = async (productId, reviewData) => {
    try {
      const payload: any = {
        product_id: productId,
        name: reviewData.name,
        email: reviewData.email,
        review: reviewData.review,
        rating: reviewData.rating
      };

      // Handle image uploads if provided
      if (reviewData.images && reviewData.images.length > 0) {
        try {
          const base64Images = await Promise.all(
            reviewData.images.map(img => convertImageToBase64(img))
          );
          payload.images = base64Images.filter(img => img); // Filter out failed conversions
        } catch (imageError) {
          console.error('Error converting images to base64:', imageError);
          // Continue without images if conversion fails
        }
      }

      const response = await axiosInstance.post(`${reviewsUrl}/reviews`, payload);
      return response.data;
    } catch (error) {
      console.error('Error submitting review:', error);
      throw error;
    }
  };

  const getRatingSummary = async (productId) => {
    try {
      const response = await axiosInstance.get(`${reviewsUrl}/rating-summary`, {
        params: { product_id: productId }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching rating summary:', error);
      return { average: 0, count: 0 };
    }
  };

  // ========================================================================
  // ORDER CREATION
  // ========================================================================

  const createOrder = async (orderData) => {
    try {
      const response = await axiosInstance.post(
        `${baseProxyUrl}/create-order`,
        {
          payment_method: 'cod',
          payment_method_title: 'Cash on Delivery',
          billing: {
            first_name: orderData.billing?.firstName,
            last_name: orderData.billing?.lastName,
            email: orderData.billing?.email,
            phone: orderData.billing?.phone,
            address_1: orderData.billing?.address1,
            address_2: orderData.billing?.address2,
            city: orderData.billing?.city,
            state: orderData.billing?.state,
            postcode: orderData.billing?.postcode,
            country: orderData.billing?.country || 'BD'
          },
          shipping: {
            first_name: orderData.shipping?.firstName,
            last_name: orderData.shipping?.lastName,
            address_1: orderData.shipping?.address1,
            address_2: orderData.shipping?.address2,
            city: orderData.shipping?.city,
            state: orderData.shipping?.state,
            postcode: orderData.shipping?.postcode,
            country: orderData.shipping?.country || 'BD',
            phone: orderData.shipping?.phone
          },
          line_items: orderData.items?.map(item => ({
            product_id: item.productId,
            quantity: item.quantity,
            variation_id: item.variationId
          })) || [],
          shipping_lines: orderData.shipping_lines || [],
          coupon_lines: orderData.coupons?.map(c => ({ code: c })) || []
        },
        {
          headers: {
            'X-HPM-Secret': proxySecret
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  };

  // ========================================================================
  // PUSH NOTIFICATIONS (Admin only)
  // ========================================================================

  const sendPushNotification = async (notificationData, secret = proxySecret) => {
    try {
      const response = await axiosInstance.post(
        `${kitchenHeroUrl}/push-notification`,
        {
          title: notificationData.title,
          message: notificationData.message,
          url: notificationData.url
        },
        {
          headers: {
            'X-HPM-Secret': secret
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error sending push notification:', error);
      throw error;
    }
  };

  // ========================================================================
  // UTILITIES
  // ========================================================================

  const convertImageToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  return {
    // Abandoned Carts
    trackAbandonedCart,
    markCartCompleted,

    // Contact
    submitContact,

    // Phone
    subscribePhone,

    // Products
    getProductLabels,
    getProductFAQs,
    getProductReviews,
    submitProductReview,
    getRatingSummary,

    // Orders
    createOrder,

    // Notifications
    sendPushNotification,

    // Utilities
    convertImageToBase64
  };
};

export default useHeadlessProxy;
