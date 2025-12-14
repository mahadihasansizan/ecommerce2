/// <reference types="vite/client" />

declare global {
  var fb_pixel_initialized_global: boolean;
}

declare module '*.css' {
  const content: string;
  export default content;
}
