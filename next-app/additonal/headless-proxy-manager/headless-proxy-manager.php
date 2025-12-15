    <?php
    /**
     * Plugin Name: Headless Proxy Manager
     * Description:  WooCommerce API proxy with secure backend management, CORS support, header forwarding, transient caching and admin cache controls for headless frontends. Includes advanced product layout management with box layout controls, responsive design, and category/tag-based settings.
     * Version: 3.0.0
     * Author: Team SmartWoo.Store
     * Text Domain: headless-proxy-manager
     */

    if (!defined('ABSPATH')) exit;

    if (!function_exists('hpm_get_option_name')) {
        function hpm_get_option_name() {
            return 'headless_proxy_manager_settings';
        }
    }

    if (!function_exists('hpm_get_api_namespace')) {
        function hpm_get_api_namespace() {
            $option_name = hpm_get_option_name();
            $options = get_option($option_name, array());
            $ns = !empty($options['api_namespace']) ? $options['api_namespace'] : 'headless-proxy/v1';
            $ns = ltrim($ns, '/');
            return $ns;
        }
    }

    class Headless_Proxy_Manager {
        private $option_name;
        private $text_domain = 'headless-proxy-manager';

        public function __construct() {
            $this->option_name = hpm_get_option_name();
            add_filter('option_' . $this->option_name, array($this, 'force_enable_proxy'));
            add_action('plugins_loaded', array($this, 'load_textdomain'));
            add_action('admin_menu', array($this, 'add_admin_menu'));
            add_action('admin_init', array($this, 'register_settings'));
            add_action('admin_init', array($this, 'register_brand_settings'));
            add_action('admin_notices', array($this, 'admin_notices'));
            add_action('rest_api_init', array($this, 'register_proxy_endpoints'));
            add_filter('plugin_action_links_' . plugin_basename(__FILE__), array($this, 'add_plugin_action_links'));
            add_action('rest_api_init', array($this, 'register_endpoints_force'), 5);
            add_action('rest_api_init', array($this, 'register_brand_rest'), 8);
            // Initialize Headless SEO (HSEO)
            add_action('rest_api_init', array($this, 'register_hseo_rest'), 9);
            add_action('admin_init', array($this, 'register_hseo_settings'));
            add_action('add_meta_boxes', array($this, 'add_hseo_meta_boxes'));
            add_action('save_post', array($this, 'save_hseo_meta'), 10, 2);
            add_action('save_post_product', array($this, 'save_hseo_product_meta'), 10, 2);
            // Expose custom headers to browser
            add_action('rest_api_init', function(){
                add_filter('rest_pre_serve_request', array($this, 'add_cors_and_security_headers'), 10, 4);
            });
            // Admin bar clear cache button
            add_action('admin_bar_menu', array($this, 'add_admin_bar_clear_cache_button'), 100);
            // Handle quick clear cache via URL param (admin only)
            add_action('admin_init', array($this, 'maybe_handle_quick_clear'));
            // Output brand CSS variables on both frontend and admin to keep design in sync
            add_action('wp_head', array($this, 'output_brand_css'));
            add_action('admin_head', array($this, 'output_brand_css'));
            // Output SEO meta tags in wp_head (visible in view source)
            add_action('wp_head', array($this, 'output_hseo_meta_tags'), 1);
        }

        public function force_enable_proxy($options) {
            if (!is_array($options)) $options = array(); // sane defaults
            $options['proxy_enabled'] = 1;
            $options['enable_logging'] = 1;
            $options['rate_limit'] = 1000;
            $options['allowed_endpoints'] = "/products\n/products/categories\n/data/countries\n/settings/general\n/payment_gateways\n/coupons\n/orders\n/customers\n/webhooks\n/reports/sales";
            if (empty($options['proxy_secret'])) $options['proxy_secret'] = 'change-me-please';
            if (empty($options['wc_consumer_key'])) $options['wc_consumer_key'] = 'ck_...';
            if (empty($options['wc_consumer_secret'])) $options['wc_consumer_secret'] = 'cs_...';
            if (empty($options['api_namespace'])) $options['api_namespace'] = 'headless-proxy/v1';
            if (empty($options['store_base_url'])) $options['store_base_url'] = ''; // empty = use this site
            // caching TTL for proxy responses (seconds)
            if (empty($options['cache_ttl'])) $options['cache_ttl'] = 15;
            return $options;
        }

        public function load_textdomain() {
            load_plugin_textdomain($this->text_domain, false, dirname(plugin_basename(__FILE__)) . '/languages/');
        }

        public function add_plugin_action_links($links) {
            $settings_link = '<a href="' . admin_url('admin.php?page=headless-proxy-manager') . '">' . __('Settings', $this->text_domain) . '</a>';
            array_unshift($links, $settings_link);
            return $links;
        }

        public function add_admin_menu() {
            add_menu_page( __('Headless Proxy Manager', $this->text_domain), __('Headless Proxy', $this->text_domain), 'manage_options', 'headless-proxy-manager', array($this, 'admin_page'), 'dashicons-shield', 30 );
            add_submenu_page( 'headless-proxy-manager', __('Logs', $this->text_domain), __('Logs', $this->text_domain), 'manage_options', 'headless-proxy-manager-logs', array($this, 'logs_page') );
            add_submenu_page( 'headless-proxy-manager', __('Brand Settings', $this->text_domain), __('Brand Settings', $this->text_domain), 'manage_options', 'headless-proxy-manager-brand', array($this, 'brand_settings_page') );
        }

        public function register_settings() {
            register_setting('headless_proxy_manager_settings_group', $this->option_name, array($this, 'sanitize_settings'));
            add_settings_section('hpm_main', __('API Configuration', $this->text_domain), array($this, 'settings_section_callback'), 'headless-proxy-manager');
            add_settings_section('hpm_sms', __('SMS Configuration', $this->text_domain), array($this, 'sms_settings_section_callback'), 'headless-proxy-manager');
            add_settings_section('hpm_advanced', __('Advanced Settings', $this->text_domain), array($this, 'advanced_settings_section_callback'), 'headless-proxy-manager');
            add_settings_field('store_base_url', __('Store Base URL', $this->text_domain), array($this, 'store_base_url_callback'), 'headless-proxy-manager', 'hpm_main');
            add_settings_field('wc_consumer_key', __('WooCommerce Consumer Key', $this->text_domain), array($this, 'consumer_key_callback'), 'headless-proxy-manager', 'hpm_main');
            add_settings_field('wc_consumer_secret', __('WooCommerce Consumer Secret', $this->text_domain), array($this, 'consumer_secret_callback'), 'headless-proxy-manager', 'hpm_main');
            add_settings_field('proxy_secret', __('Proxy Shared Secret', $this->text_domain), array($this, 'proxy_secret_callback'), 'headless-proxy-manager', 'hpm_main');
            add_settings_field('proxy_enabled', __('Enable Proxy', $this->text_domain), array($this, 'proxy_enabled_callback'), 'headless-proxy-manager', 'hpm_main');
            add_settings_field('sms_api_token', __('Greenweb SMS API Token', $this->text_domain), array($this, 'sms_api_token_callback'), 'headless-proxy-manager', 'hpm_sms');
            add_settings_field('sms_enabled', __('Enable SMS Features', $this->text_domain), array($this, 'sms_enabled_callback'), 'headless-proxy-manager', 'hpm_sms');
            add_settings_field('api_namespace', __('API Namespace (REST)', $this->text_domain), array($this, 'api_namespace_callback'), 'headless-proxy-manager', 'hpm_advanced');
            add_settings_field('enable_logging', __('Enable Request Logging', $this->text_domain), array($this, 'enable_logging_callback'), 'headless-proxy-manager', 'hpm_advanced');
            add_settings_field('allowed_endpoints',__('Allowed Endpoints', $this->text_domain), array($this, 'allowed_endpoints_callback'), 'headless-proxy-manager', 'hpm_advanced');
            add_settings_field('rate_limit', __('Rate Limit (requests per minute)', $this->text_domain), array($this, 'rate_limit_callback'), 'headless-proxy-manager', 'hpm_advanced');
            add_settings_field('cache_ttl', __('Proxy Cache TTL (seconds)', $this->text_domain), array($this, 'cache_ttl_callback'), 'headless-proxy-manager', 'hpm_advanced');
        }

        /**
         * Brand settings
         */
        public function register_brand_settings() {
            register_setting('headless_proxy_brand_settings_group', 'headless_proxy_brand_settings', array($this, 'sanitize_brand_settings'));

            add_settings_section('hpm_brand', __('Brand Settings', $this->text_domain), '__return_false', 'headless-proxy-manager-brand');

            add_settings_field('primary_color', __('Primary Color', $this->text_domain), array($this, 'primary_color_callback'), 'headless-proxy-manager-brand', 'hpm_brand');
            add_settings_field('secondary_color', __('Secondary Color', $this->text_domain), array($this, 'secondary_color_callback'), 'headless-proxy-manager-brand', 'hpm_brand');
            add_settings_field('brand_font', __('Base Font Family', $this->text_domain), array($this, 'brand_font_callback'), 'headless-proxy-manager-brand', 'hpm_brand');
            
            // Homepage SEO Settings (like Yoast SEO)
            add_settings_section('hpm_brand_seo', __('Homepage SEO Settings', $this->text_domain), array($this, 'brand_seo_section_callback'), 'headless-proxy-manager-brand');
            add_settings_field('homepage_seo_title', __('Homepage SEO Title', $this->text_domain), array($this, 'homepage_seo_title_callback'), 'headless-proxy-manager-brand', 'hpm_brand_seo');
            add_settings_field('homepage_seo_description', __('Homepage SEO Description', $this->text_domain), array($this, 'homepage_seo_description_callback'), 'headless-proxy-manager-brand', 'hpm_brand_seo');
            add_settings_field('homepage_seo_image', __('Homepage SEO Feature Image', $this->text_domain), array($this, 'homepage_seo_image_callback'), 'headless-proxy-manager-brand', 'hpm_brand_seo');
        }

        public function sanitize_settings($input) {
            $sanitized = array();
            $sanitized['store_base_url'] = isset($input['store_base_url']) ? esc_url_raw(trim($input['store_base_url'])) : '';
            $sanitized['wc_consumer_key'] = sanitize_text_field($input['wc_consumer_key'] ?? '');
            $sanitized['wc_consumer_secret'] = sanitize_text_field($input['wc_consumer_secret'] ?? '');
            $sanitized['proxy_secret'] = sanitize_text_field($input['proxy_secret'] ?? '');
            $sanitized['proxy_enabled'] = isset($input['proxy_enabled']) ? 1 : 0;
            $sanitized['sms_api_token'] = sanitize_text_field($input['sms_api_token'] ?? '');
            $sanitized['sms_enabled'] = isset($input['sms_enabled']) ? 1 : 0;
            $sanitized['enable_logging'] = isset($input['enable_logging']) ? 1 : 0;
            $sanitized['allowed_endpoints'] = sanitize_textarea_field($input['allowed_endpoints'] ?? '');
            $sanitized['rate_limit'] = absint($input['rate_limit'] ?? 100);
            $sanitized['api_namespace'] = sanitize_text_field($input['api_namespace'] ?? 'headless-proxy/v1');
            $sanitized['cache_ttl'] = absint($input['cache_ttl'] ?? 15);
            return $sanitized;
        }

        public function sanitize_brand_settings($input) {
            $sanitized = array();
            $sanitized['primary_color'] = sanitize_hex_color($input['primary_color'] ?? '#0ea5e9');
            $sanitized['secondary_color'] = sanitize_hex_color($input['secondary_color'] ?? '#1f2937');
            $sanitized['brand_font'] = sanitize_text_field($input['brand_font'] ?? 'Inter, Arial, sans-serif');
            // Homepage SEO fields
            $sanitized['homepage_seo_title'] = sanitize_text_field($input['homepage_seo_title'] ?? '');
            $sanitized['homepage_seo_description'] = sanitize_textarea_field($input['homepage_seo_description'] ?? '');
            $sanitized['homepage_seo_image'] = esc_url_raw($input['homepage_seo_image'] ?? '');
            return $sanitized;
        }

        public function settings_section_callback() {
            echo '<p>' . esc_html__('Configure WooCommerce store URL, API credentials and proxy settings.', $this->text_domain) . '</p>';
        }

        public function sms_settings_section_callback() {
            echo '<p>' . esc_html__('Configure SMS settings for order notifications.', $this->text_domain) . '</p>';
        }

        public function advanced_settings_section_callback() {
            echo '<p>' . esc_html__('Advanced configuration options for security and performance.', $this->text_domain) . '</p>';
        }

        public function store_base_url_callback() {
            $options = get_option($this->option_name, array());
            $value = $options['store_base_url'] ?? '';
            echo '<input type="text" name="' . esc_attr($this->option_name) . '[store_base_url]" value="' . esc_attr($value) . '" class="regular-text" placeholder="https://example.com" />';
            echo '<p class="description">' . esc_html__('Base URL of the WooCommerce store. Leave empty to use this WordPress site.', $this->text_domain) . '</p>';
        }

        public function cache_ttl_callback() {
            $options = get_option($this->option_name, array());
            $value = isset($options['cache_ttl']) ? (int)$options['cache_ttl'] : 15;
            echo '<input type="number" name="' . esc_attr($this->option_name) . '[cache_ttl]" value="' . esc_attr($value) . '" min="0" max="86400" />';
            echo '<p class="description">' . esc_html__('How long to cache proxy responses in seconds. Set 0 to disable caching.', $this->text_domain) . '</p>';
        }

        // ... other callbacks (consumer_key_callback, consumer_secret_callback etc.) - keep original implementations
        public function consumer_key_callback() {
            $options = get_option($this->option_name, array());
            $value = $options['wc_consumer_key'] ?? '';
            echo '<input type="text" name="' . esc_attr($this->option_name) . '[wc_consumer_key]" value="' . esc_attr($value) . '" class="regular-text" placeholder="ck_..." />';
        }

        public function consumer_secret_callback() {
            $options = get_option($this->option_name, array());
            $value = $options['wc_consumer_secret'] ?? '';
            echo '<input type="password" name="' . esc_attr($this->option_name) . '[wc_consumer_secret]" value="' . esc_attr($value) . '" class="regular-text" placeholder="cs_..." />';
        }

        public function proxy_secret_callback() {
            $options = get_option($this->option_name, array());
            $value = $options['proxy_secret'] ?? '';
            ?>
            <input type="text" name="<?php echo esc_attr($this->option_name); ?>[proxy_secret]" value="<?php echo esc_attr($value); ?>" class="regular-text" />
            <button type="button" id="hpm-generate-secret" class="button button-secondary"><?php esc_html_e('Generate Secret', $this->text_domain); ?></button>
            <?php
        }

        public function proxy_enabled_callback() {
            $options = get_option($this->option_name, array());
            $checked = !empty($options['proxy_enabled']) ? 'checked' : '';
            echo '<input type="checkbox" name="' . esc_attr($this->option_name) . '[proxy_enabled]" value="1" ' . $checked . ' /> <label>' . esc_html__('Enable Proxy', $this->text_domain) . '</label>';
        }

        public function sms_api_token_callback() {
            $options = get_option($this->option_name, array());
            $value = $options['sms_api_token'] ?? '';
            echo '<input type="password" name="' . esc_attr($this->option_name) . '[sms_api_token]" value="' . esc_attr($value) . '" class="regular-text" placeholder="Your Greenweb SMS API token" />';
            echo '<p class="description">' . esc_html__('Get your API token from Greenweb SMS dashboard.', $this->text_domain) . '</p>';
        }

        public function sms_enabled_callback() {
            $options = get_option($this->option_name, array());
            $checked = !empty($options['sms_enabled']) ? 'checked' : '';
            echo '<input type="checkbox" name="' . esc_attr($this->option_name) . '[sms_enabled]" value="1" ' . $checked . ' /> <label>' . esc_html__('Enable SMS features', $this->text_domain) . '</label>';
        }

        public function api_namespace_callback() {
            $options = get_option($this->option_name, array());
            $value = $options['api_namespace'] ?? 'headless-proxy/v1';
            echo '<input type="text" name="' . esc_attr($this->option_name) . '[api_namespace]" value="' . esc_attr($value) . '" class="regular-text" />';
            echo '<p class="description">' . esc_html__('REST namespace used for the proxy, e.g. "headless-proxy/v1".', $this->text_domain) . '</p>';
        }

        public function enable_logging_callback() {
            $options = get_option($this->option_name, array());
            $checked = !empty($options['enable_logging']) ? 'checked' : '';
            echo '<input type="checkbox" name="' . esc_attr($this->option_name) . '[enable_logging]" value="1" ' . $checked . ' /> <label>' . esc_html__('Log all proxy requests', $this->text_domain) . '</label>';
        }

        // Brand settings fields
        public function primary_color_callback() {
            $options = get_option('headless_proxy_brand_settings', array());
            $value = $options['primary_color'] ?? '#0ea5e9';
            echo '<input type="text" name="headless_proxy_brand_settings[primary_color]" value="' . esc_attr($value) . '" class="regular-text" />';
            echo '<p class="description">' . esc_html__('Primary brand color (hex).', $this->text_domain) . '</p>';
        }

        public function secondary_color_callback() {
            $options = get_option('headless_proxy_brand_settings', array());
            $value = $options['secondary_color'] ?? '#1f2937';
            echo '<input type="text" name="headless_proxy_brand_settings[secondary_color]" value="' . esc_attr($value) . '" class="regular-text" />';
            echo '<p class="description">' . esc_html__('Secondary brand color (hex).', $this->text_domain) . '</p>';
        }

        public function brand_font_callback() {
            $options = get_option('headless_proxy_brand_settings', array());
            $value = $options['brand_font'] ?? 'Inter, Arial, sans-serif';
            echo '<input type="text" name="headless_proxy_brand_settings[brand_font]" value="' . esc_attr($value) . '" class="regular-text" />';
            echo '<p class="description">' . esc_html__('CSS font-family to use across the brand.', $this->text_domain) . '</p>';
        }

        public function brand_seo_section_callback() {
            echo '<p>' . esc_html__('Configure SEO settings for your homepage. These will be used when no specific SEO data is set for individual pages.', $this->text_domain) . '</p>';
        }

        public function homepage_seo_title_callback() {
            $options = get_option('headless_proxy_brand_settings', array());
            $value = $options['homepage_seo_title'] ?? '';
            echo '<input type="text" name="headless_proxy_brand_settings[homepage_seo_title]" value="' . esc_attr($value) . '" class="regular-text" />';
            echo '<p class="description">' . esc_html__('SEO title for the homepage (recommended: 50-60 characters).', $this->text_domain) . '</p>';
        }

        public function homepage_seo_description_callback() {
            $options = get_option('headless_proxy_brand_settings', array());
            $value = $options['homepage_seo_description'] ?? '';
            echo '<textarea name="headless_proxy_brand_settings[homepage_seo_description]" rows="3" cols="50" class="large-text">' . esc_textarea($value) . '</textarea>';
            echo '<p class="description">' . esc_html__('SEO description for the homepage (recommended: 120-160 characters).', $this->text_domain) . '</p>';
        }

        public function homepage_seo_image_callback() {
            $options = get_option('headless_proxy_brand_settings', array());
            $value = $options['homepage_seo_image'] ?? '';
            ?>
            <input type="url" name="headless_proxy_brand_settings[homepage_seo_image]" value="<?php echo esc_attr($value); ?>" class="regular-text" placeholder="https://example.com/image.jpg" />
            <button type="button" class="button" id="hpm-select-seo-image"><?php esc_html_e('Select Image', $this->text_domain); ?></button>
            <?php if ($value): ?>
                <div style="margin-top: 10px;">
                    <img src="<?php echo esc_url($value); ?>" style="max-width: 300px; height: auto;" alt="Homepage SEO Image Preview" />
                </div>
            <?php endif; ?>
            <p class="description"><?php esc_html_e('Open Graph image for the homepage (recommended: 1200x630px).', $this->text_domain); ?></p>
            <script>
                jQuery(function($){
                    $('#hpm-select-seo-image').on('click', function(e){
                        e.preventDefault();
                        var button = $(this);
                        var input = $('input[name="headless_proxy_brand_settings[homepage_seo_image]"]');
                        var frame = wp.media({
                            title: '<?php esc_html_e('Select Homepage SEO Image', $this->text_domain); ?>',
                            button: { text: '<?php esc_html_e('Use this image', $this->text_domain); ?>' },
                            multiple: false
                        });
                        frame.on('select', function(){
                            var attachment = frame.state().get('selection').first().toJSON();
                            input.val(attachment.url);
                            if (input.next('.hpm-image-preview').length) {
                                input.next('.hpm-image-preview').remove();
                            }
                            input.after('<div class="hpm-image-preview" style="margin-top: 10px;"><img src="' + attachment.url + '" style="max-width: 300px; height: auto;" alt="Homepage SEO Image Preview" /></div>');
                        });
                        frame.open();
                    });
                });
            </script>
            <?php
        }

        public function allowed_endpoints_callback() {
            $options = get_option($this->option_name, array());
            $default = "/products\n/products/categories\n/data/countries\n/settings/general\n/payment_gateways\n/coupons\n/orders\n/customers\n/webhooks\n/reports/sales";
            $value = $options['allowed_endpoints'] ?? $default;
            echo '<textarea name="' . esc_attr($this->option_name) . '[allowed_endpoints]" rows="8" cols="50" class="large-text code">' . esc_textarea($value) . '</textarea>';
            echo '<p class="description">' . esc_html__('One endpoint per line. Prefix with Woo REST path segments.', $this->text_domain) . '</p>';
        }

        public function rate_limit_callback() {
            $options = get_option($this->option_name, array());
            $value = isset($options['rate_limit']) ? (int)$options['rate_limit'] : 100;
            echo '<input type="number" name="' . esc_attr($this->option_name) . '[rate_limit]" value="' . esc_attr($value) . '" min="1" max="5000" />';
            echo '<p class="description">' . esc_html__('Maximum requests per minute per IP address.', $this->text_domain) . '</p>';
        }

        public function admin_page() {
            if (!current_user_can('manage_options')) wp_die(__('You do not have sufficient permissions to access this page.', $this->text_domain));
            $ns = hpm_get_api_namespace();
            ?>
            <div class="wrap">
                <h1><?php _e('Headless Proxy Manager Settings', $this->text_domain); ?></h1>
                <form method="post" action="options.php">
                    <?php settings_fields('headless_proxy_manager_settings_group'); ?>
                    <?php do_settings_sections('headless-proxy-manager'); ?>
                    <?php submit_button(); ?>
                </form>
                <div class="card" style="margin-top:20px;">
                    <h2><?php _e('Frontend Configuration', $this->text_domain); ?></h2>
                    <p><?php _e('Add these to your frontend .env (example):', $this->text_domain); ?></p>
                    <pre style="background:#f5f5f5;padding:10px;border:1px solid #ddd;">
    VITE_WP_PROXY_BASE_URL=<?php echo esc_html( home_url( '/wp-json/' . $ns ) ); ?>
    VITE_WP_ORDER_PROXY_URL=<?php echo esc_html( home_url( '/wp-json/' . $ns . '/create-order' ) ); ?>
    VITE_WP_ORDER_PROXY_SECRET=<?php echo esc_html( $this->get_proxy_secret() ); ?>
    VITE_WP_SMS_PROXY_URL=<?php echo esc_html( home_url( '/wp-json/' . $ns . '/send-sms' ) ); ?>
    VITE_WP_SMS_CALLBACK_URL=<?php echo esc_html( home_url( '/wp-json/' . $ns . '/sms-callback' ) ); ?>
                    </pre>
                </div>
                <div class="card" style="margin-top:20px;">
                    <h2><?php _e('Test Endpoints', $this->text_domain); ?></h2>
                    <ul>
                        <li><strong>Proxy:</strong> <code><?php echo esc_html( home_url( '/wp-json/' . $ns . '/proxy' ) ); ?></code></li>
                        <li><strong>Create Order:</strong> <code><?php echo esc_html( home_url( '/wp-json/' . $ns . '/create-order' ) ); ?></code></li>
                        <li><strong>Send SMS:</strong> <code><?php echo esc_html( home_url( '/wp-json/' . $ns . '/send-sms' ) ); ?></code></li>
                        <li><strong>SMS Callback:</strong> <code><?php echo esc_html( home_url( '/wp-json/' . $ns . '/sms-callback' ) ); ?></code></li>
                        <li><strong>Test Connection:</strong> <code><?php echo esc_html( home_url( '/wp-json/' . $ns . '/test-connection' ) ); ?></code></li>
                        <li><strong>Clear Cache (REST):</strong> <code><?php echo esc_html( home_url( '/wp-json/' . $ns . '/clear-cache' ) ); ?></code></li>
                    </ul>
                </div>
            </div>
            <script>
                jQuery(function($){
                    $('#hpm-generate-secret').on('click', function(){
                        const s = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
                        $('input[name="<?php echo esc_js($this->option_name); ?>[proxy_secret]"]').val(s);
                    });
                });
            </script>
            <?php
        }

        public function logs_page() {
            if (!current_user_can('manage_options')) wp_die(__('You do not have sufficient permissions to access this page.', $this->text_domain));
            if (isset($_POST['clear_logs']) && wp_verify_nonce($_POST['_wpnonce'], 'hpm_clear_logs')) {
                delete_option('headless_proxy_manager_logs');
                echo '<div class="notice notice-success"><p>' . esc_html__('Logs cleared successfully.', $this->text_domain) . '</p></div>';
            }
            $logs = get_option('headless_proxy_manager_logs', array());
            ?>
            <div class="wrap">
                <h1><?php _e('Headless Proxy Logs', $this->text_domain); ?></h1>
                <form method="post" style="margin-bottom:20px;">
                    <?php wp_nonce_field('hpm_clear_logs'); ?>
                    <input type="submit" name="clear_logs" class="button" value="<?php _e('Clear All Logs', $this->text_domain); ?>" onclick="return confirm('<?php _e('Are you sure you want to clear all logs?', $this->text_domain); ?>');">
                </form>
                <table class="wp-list-table widefat fixed striped">
                    <thead><tr><th><?php _e('Time',$this->text_domain);?></th><th><?php _e('Endpoint',$this->text_domain);?></th><th><?php _e('Method',$this->text_domain);?></th><th><?php _e('Status',$this->text_domain);?></th><th><?php _e('IP Address',$this->text_domain);?></th><th><?php _e('Response Time',$this->text_domain);?></th></tr></thead>
                    <tbody>
                    <?php if (empty($logs)): ?>
                        <tr><td colspan="6"><?php _e('No logs available.', $this->text_domain); ?></td></tr>
                    <?php else: foreach (array_reverse($logs) as $log): ?>
                        <tr>
                            <td><?php echo esc_html($log['time'] ?? ''); ?></td>
                            <td><?php echo esc_html($log['endpoint'] ?? ''); ?></td>
                            <td><?php echo esc_html($log['method'] ?? ''); ?></td>
                            <td><?php echo esc_html($log['status'] ?? ''); ?></td>
                            <td><?php echo esc_html($log['ip'] ?? ''); ?></td>
                            <td><?php echo esc_html($log['response_time'] ?? ''); ?>ms</td>
                        </tr>
                    <?php endforeach; endif; ?>
                    </tbody>
                </table>
            </div>
            <?php
        }

        public function brand_settings_page() {
            if (!current_user_can('manage_options')) wp_die(__('You do not have sufficient permissions to access this page.', $this->text_domain));
            
            // Enqueue media uploader scripts
            wp_enqueue_media();
            
            $options = get_option('headless_proxy_brand_settings', array());
            ?>
            <div class="wrap">
                <h1><?php _e('Brand Settings', $this->text_domain); ?></h1>
                <form method="post" action="options.php">
                    <?php settings_fields('headless_proxy_brand_settings_group'); ?>
                    <?php do_settings_sections('headless-proxy-manager-brand'); ?>
                    <?php submit_button(); ?>
                </form>
                <p class="description"><?php _e('These values can be consumed by your headless frontend to keep colors and typography consistent.', $this->text_domain); ?></p>
            </div>
            <?php
        }

        public function admin_notices() {
            $options = get_option($this->option_name, array());
            if (empty($options['wc_consumer_key']) || empty($options['wc_consumer_secret'])) {
                echo '<div class="notice notice-warning is-dismissible"><p><strong>' . esc_html__('Headless Proxy Manager:', $this->text_domain) . '</strong> ' . esc_html__('WooCommerce API credentials are not configured.', $this->text_domain) . '</p></div>';
            }
            if (empty($options['proxy_secret'])) {
                echo '<div class="notice notice-error is-dismissible"><p><strong>' . esc_html__('Headless Proxy Manager:', $this->text_domain) . '</strong> ' . esc_html__('Proxy shared secret is not set.', $this->text_domain) . '</p></div>';
            }
            if (empty($options['proxy_enabled'])) {
                echo '<div class="notice notice-info is-dismissible"><p><strong>' . esc_html__('Headless Proxy Manager:', $this->text_domain) . '</strong> ' . esc_html__('Proxy is currently disabled.', $this->text_domain) . '</p></div>';
            }
            if (!empty($options['sms_enabled']) && empty($options['sms_api_token'])) {
                echo '<div class="notice notice-warning is-dismissible"><p><strong>' . esc_html__('Headless Proxy Manager:', $this->text_domain) . '</strong> ' . esc_html__('SMS is enabled but API token is not configured.', $this->text_domain) . '</p></div>';
            }
        }

        public function register_endpoints_force() {
            $ns = hpm_get_api_namespace();
            // Ensure namespace doesn't have leading/trailing slashes
            $ns = trim($ns, '/');
            
            // Register proxy endpoint - allow parameters from query or body
            register_rest_route($ns, '/proxy', array(
                'methods' => array('GET','POST','PUT','DELETE','OPTIONS'),
                'callback' => array($this, 'handle_proxy_request'),
                'permission_callback' => array($this, 'verify_proxy_secret'),
                'args' => array() // Remove strict validation, handle in callback
            ));
            register_rest_route($ns, '/create-order', array(
                'methods' => array('POST','OPTIONS'),
                'callback' => array($this, 'handle_order_creation'),
                'permission_callback' => array($this, 'verify_proxy_secret'),
            ));
            register_rest_route($ns, '/start-checkout', array(
                'methods' => array('POST','OPTIONS'),
                'callback' => array($this, 'handle_checkout_session'),
                'permission_callback' => array($this, 'verify_proxy_secret'),
            ));
            register_rest_route($ns, '/calculate-shipping', array(
                'methods' => array('POST','OPTIONS'),
                'callback' => array($this, 'handle_calculate_shipping'),
                'permission_callback' => array($this, 'verify_proxy_secret'),
            ));
            register_rest_route($ns, '/test-connection', array(
                'methods' => array('GET','OPTIONS'),
                'callback' => array($this, 'handle_test_connection'),
                'permission_callback' => array($this, 'verify_proxy_secret'),
            ));
            register_rest_route($ns, '/sms-callback', array(
                'methods' => array('POST','OPTIONS'),
                'callback' => array($this, 'handle_sms_callback'),
                'permission_callback' => '__return_true', // SMS providers don't send auth headers
            ));
            register_rest_route($ns, '/send-sms', array(
                'methods' => array('POST','OPTIONS'),
                'callback' => array($this, 'handle_send_sms'),
                'permission_callback' => array($this, 'verify_proxy_secret'),
            ));

            // Wishlist Endpoints
            register_rest_route($ns, '/wishlist', array(
                'methods' => 'GET',
                'callback' => array($this, 'get_wishlist'),
                'permission_callback' => array($this, 'verify_proxy_secret'),
                'args' => array(
                    'user_id' => array(
                        'required' => true,
                        'validate_callback' => function($param) {
                            return is_numeric($param);
                        }
                    )
                )
            ));

            register_rest_route($ns, '/wishlist/add', array(
                'methods' => 'POST',
                'callback' => array($this, 'add_to_wishlist'),
                'permission_callback' => array($this, 'verify_proxy_secret'),
            ));

            register_rest_route($ns, '/wishlist/remove', array(
                'methods' => 'POST',
                'callback' => array($this, 'remove_from_wishlist'),
                'permission_callback' => array($this, 'verify_proxy_secret'),
            ));
            // Clear cache endpoint (admins or valid secret)
            register_rest_route($ns, '/clear-cache', array(
                'methods' => array('POST','OPTIONS'),
                'callback' => array($this, 'handle_clear_cache'),
                'permission_callback' => function($request) {
                    // allow either admin or valid secret header
                    if (is_user_logged_in() && current_user_can('manage_options')) return true;
                    $secret = $request->get_header('x-hpm-secret') ?: $request->get_header('X-HPM-Secret');
                    $stored = (new Headless_Proxy_Manager())->get_proxy_secret();
                    return (!empty($secret) && $secret === $stored) ? true : new WP_Error('forbidden', 'Not authorized', array('status' => 403));
                }
            ));
        }

        public function register_proxy_endpoints() {
            $options = get_option($this->option_name, array());
            if (empty($options['proxy_enabled'])) return;
            // Kept for backward compatibility if you need extra routes in future
        }

        public function verify_proxy_secret($request) {
            $secret = $request->get_header('x-hpm-secret') ?: $request->get_header('X-HPM-Secret');
            $stored_secret = $this->get_proxy_secret();
            if (empty($secret) || empty($stored_secret) || $secret !== $stored_secret) {
                return new WP_Error('invalid_secret', __('Invalid or missing proxy secret', $this->text_domain), array('status' => 403));
            }
            return true;
        }

        public function register_brand_rest() {
            $ns = hpm_get_api_namespace();
            register_rest_route($ns, '/brand-settings', array(
                'methods' => 'GET',
                'permission_callback' => '__return_true',
                'callback' => function() {
                    return $this->get_brand_settings();
                }
            ));
            
            // Register site info endpoint for dynamic site name and store base URL
            register_rest_route($ns, '/site-info', array(
                'methods' => 'GET',
                'permission_callback' => '__return_true',
                'callback' => function() {
                    return $this->get_site_info();
                }
            ));
        }
        
        /**
         * Get site information including site name and store base URL
         */
        private function get_site_info() {
            $options = get_option($this->option_name, array());
            
            // Get site name from WordPress settings
            $site_name = get_bloginfo('name');
            if (empty($site_name)) {
                $site_name = get_bloginfo('site_name');
            }
            if (empty($site_name)) {
                $site_name = 'Store'; // Fallback
            }
            
            // Get store base URL from plugin settings, or use current site URL
            $store_base_url = !empty($options['store_base_url']) ? rtrim($options['store_base_url'], '/') : '';
            if (empty($store_base_url)) {
                $store_base_url = home_url();
            }
            
            // Ensure URL doesn't have trailing slash
            $store_base_url = rtrim($store_base_url, '/');
            
            return array(
                'site_name' => $site_name,
                'store_base_url' => $store_base_url,
                'site_url' => home_url(),
            );
        }

        /**
         * Register HSEO REST API endpoints
         */
        public function register_hseo_rest() {
            $ns = hpm_get_api_namespace();
            
            // Get SEO data by route path
            register_rest_route($ns, '/hseo/get', array(
                'methods' => 'GET',
                'permission_callback' => '__return_true',
                'callback' => array($this, 'hseo_get_data'),
                'args' => array(
                    'path' => array(
                        'required' => true,
                        'type' => 'string',
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                ),
            ));
            
            // Update SEO data
            register_rest_route($ns, '/hseo/update', array(
                'methods' => 'POST',
                'permission_callback' => array($this, 'verify_proxy_secret'),
                'callback' => array($this, 'hseo_update_data'),
            ));
            
            // Get SEO data by object ID and type
            register_rest_route($ns, '/hseo/get-by-object', array(
                'methods' => 'GET',
                'permission_callback' => '__return_true',
                'callback' => array($this, 'hseo_get_by_object'),
                'args' => array(
                    'object_id' => array(
                        'required' => true,
                        'type' => 'integer',
                        'sanitize_callback' => 'absint',
                    ),
                    'object_type' => array(
                        'required' => true,
                        'type' => 'string',
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                ),
            ));

            // Test connection endpoint
            register_rest_route($ns, '/hseo/test', array(
                'methods' => 'GET',
                'permission_callback' => '__return_true',
                'callback' => array($this, 'hseo_test_connection'),
            ));
        }

        public function get_wishlist($request) {
            $user_id = $request->get_param('user_id');
            $wishlist = get_user_meta($user_id, '_hpm_wishlist', true);
            
            if (!is_array($wishlist)) {
                $wishlist = [];
            }

            // Optional: Hydrate products
            // For now, return IDs
            return rest_ensure_response($wishlist);
        }

        public function add_to_wishlist($request) {
            $params = $request->get_json_params();
            $user_id = isset($params['user_id']) ? intval($params['user_id']) : 0;
            $product_id = isset($params['product_id']) ? intval($params['product_id']) : 0;

            if (!$user_id || !$product_id) {
                return new WP_Error('invalid_params', 'User ID and Product ID required', ['status' => 400]);
            }

            $wishlist = get_user_meta($user_id, '_hpm_wishlist', true);
            if (!is_array($wishlist)) {
                $wishlist = [];
            }

            if (!in_array($product_id, $wishlist)) {
                $wishlist[] = $product_id;
                update_user_meta($user_id, '_hpm_wishlist', $wishlist);
            }

            return rest_ensure_response(array('success' => true, 'wishlist' => $wishlist));
        }

        public function remove_from_wishlist($request) {
            $params = $request->get_json_params();
            $user_id = isset($params['user_id']) ? intval($params['user_id']) : 0;
            $product_id = isset($params['product_id']) ? intval($params['product_id']) : 0;

            if (!$user_id || !$product_id) {
                return new WP_Error('invalid_params', 'User ID and Product ID required', ['status' => 400]);
            }

            $wishlist = get_user_meta($user_id, '_hpm_wishlist', true);
            if (!is_array($wishlist)) {
                $wishlist = [];
            }

            $key = array_search($product_id, $wishlist);
            if ($key !== false) {
                unset($wishlist[$key]);
                $wishlist = array_values($wishlist); // Reindex
                update_user_meta($user_id, '_hpm_wishlist', $wishlist);
            }

            return rest_ensure_response(array('success' => true, 'wishlist' => $wishlist));
        }

        /**
         * Test HSEO connection and return status
         */
        public function hseo_test_connection($request) {
            global $wpdb;
            $table_name = $wpdb->prefix . 'hseo_data';
            
            // Check if table exists
            $table_exists = $wpdb->get_var("SHOW TABLES LIKE '$table_name'") === $table_name;
            
            // Get table count
            $count = 0;
            if ($table_exists) {
                $count = (int) $wpdb->get_var("SELECT COUNT(*) FROM $table_name");
            }
            
            // Test current path detection
            $current_path = $this->hseo_get_current_path();
            
            return array(
                'status' => 'success',
                'message' => 'HSEO plugin is working correctly',
                'table_exists' => $table_exists,
                'seo_data_count' => $count,
                'current_path' => $current_path,
                'wp_head_hook' => has_action('wp_head', array($this, 'output_hseo_meta_tags')) !== false,
                'plugin_version' => '1.1.0',
                'timestamp' => current_time('mysql'),
            );
        }
        
        /**
         * Get SEO data by route path
         */
        public function hseo_get_data($request) {
            $path = $request->get_param('path');
            if (empty($path)) {
                return new WP_Error('missing_path', 'Path parameter is required', array('status' => 400));
            }
            
            // Normalize path
            $path = '/' . ltrim($path, '/');
            
            global $wpdb;
            $table_name = $wpdb->prefix . 'hseo_data';
            
            // Try to find by route path first
            $seo_data = $wpdb->get_row($wpdb->prepare(
                "SELECT * FROM $table_name WHERE route_path = %s ORDER BY updated_at DESC LIMIT 1",
                $path
            ), ARRAY_A);
            
            // If not found, try to match by object (product, page, etc.)
            if (!$seo_data) {
                $seo_data = $this->hseo_get_data_by_path($path);
            }
            
            // If still not found, try to generate default data
            if (!$seo_data) {
                // For API requests, return 404 (frontend will use fallbacks)
                // But for wp_head output, we generate defaults
                return new WP_Error('not_found', 'SEO data not found for this path', array('status' => 404));
            }
            
            // Build response with all SEO data
            $response = $this->hseo_build_response($seo_data, $path);
            
            // Ensure response is always an array (not WP_Error)
            if (is_wp_error($response)) {
                return $response;
            }
            
            return $response;
        }
        
        /**
         * Get SEO data by object ID and type
         */
        public function hseo_get_by_object($request) {
            $object_id = $request->get_param('object_id');
            $object_type = $request->get_param('object_type');
            
            if (empty($object_id) || empty($object_type)) {
                return new WP_Error('missing_params', 'object_id and object_type are required', array('status' => 400));
            }
            
            global $wpdb;
            $table_name = $wpdb->prefix . 'hseo_data';
            
            $seo_data = $wpdb->get_row($wpdb->prepare(
                "SELECT * FROM $table_name WHERE object_id = %d AND object_type = %s ORDER BY updated_at DESC LIMIT 1",
                $object_id,
                $object_type
            ), ARRAY_A);
            
            if (!$seo_data) {
                return new WP_Error('not_found', 'SEO data not found', array('status' => 404));
            }
            
            $path = $seo_data['route_path'] ?: $this->hseo_get_path_for_object($object_id, $object_type);
            return $this->hseo_build_response($seo_data, $path);
        }
        
        /**
         * Update SEO data
         */
        public function hseo_update_data($request) {
            $data = $request->get_json_params();
            
            if (empty($data['object_id']) || empty($data['object_type'])) {
                return new WP_Error('missing_params', 'object_id and object_type are required', array('status' => 400));
            }
            
            global $wpdb;
            $table_name = $wpdb->prefix . 'hseo_data';
            
            $object_id = absint($data['object_id']);
            $object_type = sanitize_text_field($data['object_type']);
            $route_path = !empty($data['route_path']) ? sanitize_text_field($data['route_path']) : $this->hseo_get_path_for_object($object_id, $object_type);
            
            // Prepare data for insert/update
            $seo_data = array(
                'object_id' => $object_id,
                'object_type' => $object_type,
                'route_path' => $route_path,
                'meta_title' => !empty($data['meta_title']) ? sanitize_text_field($data['meta_title']) : null,
                'meta_description' => !empty($data['meta_description']) ? sanitize_textarea_field($data['meta_description']) : null,
                'meta_keywords' => !empty($data['meta_keywords']) ? sanitize_text_field($data['meta_keywords']) : null,
                'og_title' => !empty($data['og_title']) ? sanitize_text_field($data['og_title']) : null,
                'og_description' => !empty($data['og_description']) ? sanitize_textarea_field($data['og_description']) : null,
                'og_image' => !empty($data['og_image']) ? esc_url_raw($data['og_image']) : null,
                'og_type' => !empty($data['og_type']) ? sanitize_text_field($data['og_type']) : 'website',
                'twitter_title' => !empty($data['twitter_title']) ? sanitize_text_field($data['twitter_title']) : null,
                'twitter_description' => !empty($data['twitter_description']) ? sanitize_textarea_field($data['twitter_description']) : null,
                'twitter_image' => !empty($data['twitter_image']) ? esc_url_raw($data['twitter_image']) : null,
                'twitter_card' => !empty($data['twitter_card']) ? sanitize_text_field($data['twitter_card']) : 'summary_large_image',
                'robots_index' => !empty($data['robots_index']) ? sanitize_text_field($data['robots_index']) : 'index',
                'robots_follow' => !empty($data['robots_follow']) ? sanitize_text_field($data['robots_follow']) : 'follow',
                'canonical_url' => !empty($data['canonical_url']) ? esc_url_raw($data['canonical_url']) : null,
                'schema_type' => !empty($data['schema_type']) ? sanitize_text_field($data['schema_type']) : null,
                'schema_data' => !empty($data['schema_data']) ? wp_json_encode($data['schema_data']) : null,
                'faq_data' => !empty($data['faq_data']) ? wp_json_encode($data['faq_data']) : null,
            );
            
            // Check if record exists
            $existing = $wpdb->get_var($wpdb->prepare(
                "SELECT id FROM $table_name WHERE object_id = %d AND object_type = %s",
                $object_id,
                $object_type
            ));
            
            if ($existing) {
                // Update
                $wpdb->update($table_name, $seo_data, array('id' => $existing));
            } else {
                // Insert
                $wpdb->insert($table_name, $seo_data);
            }
            
            return array('success' => true, 'message' => 'SEO data saved successfully');
        }
        
        /**
         * Build SEO response with all required fields
         */
        private function hseo_build_response($seo_data, $path) {
            $site_url = home_url();
            $canonical = !empty($seo_data['canonical_url']) ? $seo_data['canonical_url'] : ($site_url . $path);
            
            // Build robots string
            $robots_parts = array();
            if (!empty($seo_data['robots_index'])) {
                $robots_parts[] = $seo_data['robots_index'];
            }
            if (!empty($seo_data['robots_follow'])) {
                $robots_parts[] = $seo_data['robots_follow'];
            }
            $robots = !empty($robots_parts) ? implode(', ', $robots_parts) : 'index, follow';
            
            // Parse schema and FAQ data
            $schema_data = array();
            if (!empty($seo_data['schema_data'])) {
                $parsed = json_decode($seo_data['schema_data'], true);
                if (is_array($parsed)) {
                    $schema_data = $parsed;
                }
            }
            
            $faq_data = array();
            if (!empty($seo_data['faq_data'])) {
                $parsed = json_decode($seo_data['faq_data'], true);
                if (is_array($parsed)) {
                    $faq_data = $parsed;
                }
            }
            
            // Build JSON-LD structured data
            $json_ld = array();
            
            // For products, auto-generate Product schema if not provided
            if ($seo_data['object_type'] === 'product' && empty($schema_data)) {
                $product = wc_get_product($seo_data['object_id']);
                if ($product) {
                    $schema_data = $this->hseo_generate_product_schema($product, $seo_data);
                }
            }
            
            // Add main schema if provided
            if (!empty($schema_data)) {
                if (isset($schema_data['@type'])) {
                    $json_ld[] = $schema_data;
                } elseif (is_array($schema_data)) {
                    $json_ld = array_merge($json_ld, $schema_data);
                }
            }
            
            // Add FAQ schema if provided
            if (!empty($faq_data)) {
                $faq_schema = array(
                    '@context' => 'https://schema.org',
                    '@type' => 'FAQPage',
                    'mainEntity' => array(),
                );
                
                foreach ($faq_data as $faq) {
                    if (!empty($faq['question']) && !empty($faq['answer'])) {
                        $faq_schema['mainEntity'][] = array(
                            '@type' => 'Question',
                            'name' => sanitize_text_field($faq['question']),
                            'acceptedAnswer' => array(
                                '@type' => 'Answer',
                                'text' => wp_kses_post($faq['answer']),
                            ),
                        );
                    }
                }
                
                if (!empty($faq_schema['mainEntity'])) {
                    $json_ld[] = $faq_schema;
                }
            }
            
            // Add BreadcrumbList schema
            $breadcrumb_schema = $this->hseo_generate_breadcrumb_schema($seo_data, $path);
            if (!empty($breadcrumb_schema)) {
                $json_ld[] = $breadcrumb_schema;
            }
            
            // Build response
            $response = array(
                'title' => !empty($seo_data['meta_title']) ? $seo_data['meta_title'] : '',
                'description' => !empty($seo_data['meta_description']) ? $seo_data['meta_description'] : '',
                'keywords' => !empty($seo_data['meta_keywords']) ? $seo_data['meta_keywords'] : '',
                'canonical' => $canonical,
                'og_title' => !empty($seo_data['og_title']) ? $seo_data['og_title'] : (!empty($seo_data['meta_title']) ? $seo_data['meta_title'] : ''),
                'og_description' => !empty($seo_data['og_description']) ? $seo_data['og_description'] : (!empty($seo_data['meta_description']) ? $seo_data['meta_description'] : ''),
                'og_image' => !empty($seo_data['og_image']) ? $seo_data['og_image'] : '',
                'og_url' => $canonical,
                'og_type' => !empty($seo_data['og_type']) ? $seo_data['og_type'] : 'website',
                'og_site_name' => get_bloginfo('name'),
                'twitter_card' => !empty($seo_data['twitter_card']) ? $seo_data['twitter_card'] : 'summary_large_image',
                'twitter_title' => !empty($seo_data['twitter_title']) ? $seo_data['twitter_title'] : (!empty($seo_data['og_title']) ? $seo_data['og_title'] : (!empty($seo_data['meta_title']) ? $seo_data['meta_title'] : '')),
                'twitter_description' => !empty($seo_data['twitter_description']) ? $seo_data['twitter_description'] : (!empty($seo_data['og_description']) ? $seo_data['og_description'] : (!empty($seo_data['meta_description']) ? $seo_data['meta_description'] : '')),
                'twitter_image' => !empty($seo_data['twitter_image']) ? $seo_data['twitter_image'] : (!empty($seo_data['og_image']) ? $seo_data['og_image'] : ''),
                'robots' => $robots,
                'json_ld' => $json_ld,
            );
            
            return $response;
        }
        
        /**
         * Get SEO data by path (try to match product/page by slug)
         */
        private function hseo_get_data_by_path($path) {
            global $wpdb;
            $table_name = $wpdb->prefix . 'hseo_data';
            
            // Try to extract slug from path
            // Path format: /product/slug or /categories/slug or /page-slug
            $path_parts = explode('/', trim($path, '/'));
            
            if (count($path_parts) >= 2 && $path_parts[0] === 'product') {
                // Product page
                $slug = $path_parts[1];
                $product = $wpdb->get_var($wpdb->prepare(
                    "SELECT ID FROM {$wpdb->posts} WHERE post_name = %s AND post_type = 'product' AND post_status = 'publish'",
                    $slug
                ));
                
                if ($product) {
                    return $wpdb->get_row($wpdb->prepare(
                        "SELECT * FROM $table_name WHERE object_id = %d AND object_type = 'product' ORDER BY updated_at DESC LIMIT 1",
                        $product
                    ), ARRAY_A);
                }
            } elseif (count($path_parts) >= 2 && $path_parts[0] === 'categories') {
                // Category page
                $slug = $path_parts[1];
                $term = get_term_by('slug', $slug, 'product_cat');
                if ($term && !is_wp_error($term)) {
                    return $wpdb->get_row($wpdb->prepare(
                        "SELECT * FROM $table_name WHERE object_id = %d AND object_type = 'product_cat' ORDER BY updated_at DESC LIMIT 1",
                        $term->term_id
                    ), ARRAY_A);
                }
            } else {
                // Try as page/post slug
                $slug = end($path_parts);
                $page = $wpdb->get_var($wpdb->prepare(
                    "SELECT ID FROM {$wpdb->posts} WHERE post_name = %s AND post_status IN ('publish', 'private') LIMIT 1",
                    $slug
                ));
                
                if ($page) {
                    $post_type = get_post_type($page);
                    return $wpdb->get_row($wpdb->prepare(
                        "SELECT * FROM $table_name WHERE object_id = %d AND object_type = %s ORDER BY updated_at DESC LIMIT 1",
                        $page,
                        $post_type
                    ), ARRAY_A);
                }
            }
            
            return null;
        }
        
        /**
         * Get route path for object
         */
        private function hseo_get_path_for_object($object_id, $object_type) {
            if ($object_type === 'product') {
                $product = wc_get_product($object_id);
                if ($product) {
                    return '/product/' . $product->get_slug();
                }
            } elseif ($object_type === 'product_cat') {
                $term = get_term($object_id, 'product_cat');
                if ($term && !is_wp_error($term)) {
                    return '/categories/' . $term->slug;
                }
            } else {
                $post = get_post($object_id);
                if ($post) {
                    return '/' . $post->post_name;
                }
            }
            
            return '/';
        }
        
        /**
         * Register HSEO settings
         */
        public function register_hseo_settings() {
            // Settings will be managed via meta boxes on posts/products
        }
        
        /**
         * Add HSEO meta boxes
         */
        public function add_hseo_meta_boxes() {
            // Add to all post types
            $post_types = get_post_types(array('public' => true));
            foreach ($post_types as $post_type) {
                add_meta_box(
                    'hseo_meta_box',
                    'Headless SEO Settings',
                    array($this, 'render_hseo_meta_box'),
                    $post_type,
                    'normal',
                    'high'
                );
            }
            
            // Add to product category
            add_action('product_cat_add_form_fields', array($this, 'render_hseo_taxonomy_fields'));
            add_action('product_cat_edit_form_fields', array($this, 'render_hseo_taxonomy_fields'));
            add_action('edited_product_cat', array($this, 'save_hseo_taxonomy_meta'), 10, 2);
            add_action('create_product_cat', array($this, 'save_hseo_taxonomy_meta'), 10, 2);
        }
        
        /**
         * Render HSEO meta box
         */
        public function render_hseo_meta_box($post) {
            wp_nonce_field('hseo_meta_box', 'hseo_meta_box_nonce');
            
            global $wpdb;
            $table_name = $wpdb->prefix . 'hseo_data';
            $seo_data = $wpdb->get_row($wpdb->prepare(
                "SELECT * FROM $table_name WHERE object_id = %d AND object_type = %s",
                $post->ID,
                $post->post_type
            ), ARRAY_A);
            
            $meta_title = $seo_data ? $seo_data['meta_title'] : '';
            $meta_description = $seo_data ? $seo_data['meta_description'] : '';
            $meta_keywords = $seo_data ? $seo_data['meta_keywords'] : '';
            $og_title = $seo_data ? $seo_data['og_title'] : '';
            $og_description = $seo_data ? $seo_data['og_description'] : '';
            $og_image = $seo_data ? $seo_data['og_image'] : '';
            $twitter_title = $seo_data ? $seo_data['twitter_title'] : '';
            $twitter_description = $seo_data ? $seo_data['twitter_description'] : '';
            $canonical_url = $seo_data ? $seo_data['canonical_url'] : '';
            $robots_index = $seo_data ? $seo_data['robots_index'] : 'index';
            $robots_follow = $seo_data ? $seo_data['robots_follow'] : 'follow';
            
            // For products, get additional fields
            $schema_data = $seo_data && !empty($seo_data['schema_data']) ? json_decode($seo_data['schema_data'], true) : array();
            $faq_data = $seo_data && !empty($seo_data['faq_data']) ? json_decode($seo_data['faq_data'], true) : array();
            
            $meta_box_file = plugin_dir_path(__FILE__) . 'hseo/admin-meta-box.php';
            if (file_exists($meta_box_file)) {
                include $meta_box_file;
            } else {
                // Fallback: render inline if file doesn't exist
                $this->render_hseo_meta_box_inline($post, $seo_data, $meta_title, $meta_description, $meta_keywords, $og_title, $og_description, $og_image, $twitter_title, $twitter_description, $canonical_url, $robots_index, $robots_follow, $schema_data, $faq_data);
            }
        }
        
        /**
         * Save HSEO meta data
         */
        public function save_hseo_meta($post_id, $post) {
            // Verify nonce
            if (!isset($_POST['hseo_meta_box_nonce']) || !wp_verify_nonce($_POST['hseo_meta_box_nonce'], 'hseo_meta_box')) {
                return;
            }
            
            // Check autosave
            if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
                return;
            }
            
            // Check permissions
            if (!current_user_can('edit_post', $post_id)) {
                return;
            }
            
            $this->hseo_save_data($post_id, $post->post_type);
        }
        
        /**
         * Save HSEO product meta (with schema and FAQ)
         */
        public function save_hseo_product_meta($post_id, $post) {
            $this->save_hseo_meta($post_id, $post);
        }
        
        /**
         * Save HSEO data to database
         */
        private function hseo_save_data($object_id, $object_type) {
            global $wpdb;
            $table_name = $wpdb->prefix . 'hseo_data';
            
            $route_path = $this->hseo_get_path_for_object($object_id, $object_type);
            
            $data = array(
                'object_id' => $object_id,
                'object_type' => $object_type,
                'route_path' => $route_path,
                'meta_title' => !empty($_POST['hseo_meta_title']) ? sanitize_text_field($_POST['hseo_meta_title']) : null,
                'meta_description' => !empty($_POST['hseo_meta_description']) ? sanitize_textarea_field($_POST['hseo_meta_description']) : null,
                'meta_keywords' => !empty($_POST['hseo_meta_keywords']) ? sanitize_text_field($_POST['hseo_meta_keywords']) : null,
                'og_title' => !empty($_POST['hseo_og_title']) ? sanitize_text_field($_POST['hseo_og_title']) : null,
                'og_description' => !empty($_POST['hseo_og_description']) ? sanitize_textarea_field($_POST['hseo_og_description']) : null,
                'og_image' => !empty($_POST['hseo_og_image']) ? esc_url_raw($_POST['hseo_og_image']) : null,
                'og_type' => !empty($_POST['hseo_og_type']) ? sanitize_text_field($_POST['hseo_og_type']) : 'website',
                'twitter_title' => !empty($_POST['hseo_twitter_title']) ? sanitize_text_field($_POST['hseo_twitter_title']) : null,
                'twitter_description' => !empty($_POST['hseo_twitter_description']) ? sanitize_textarea_field($_POST['hseo_twitter_description']) : null,
                'twitter_image' => !empty($_POST['hseo_twitter_image']) ? esc_url_raw($_POST['hseo_twitter_image']) : null,
                'twitter_card' => !empty($_POST['hseo_twitter_card']) ? sanitize_text_field($_POST['hseo_twitter_card']) : 'summary_large_image',
                'robots_index' => !empty($_POST['hseo_robots_index']) ? sanitize_text_field($_POST['hseo_robots_index']) : 'index',
                'robots_follow' => !empty($_POST['hseo_robots_follow']) ? sanitize_text_field($_POST['hseo_robots_follow']) : 'follow',
                'canonical_url' => !empty($_POST['hseo_canonical_url']) ? esc_url_raw($_POST['hseo_canonical_url']) : null,
            );
            
            // For products, save schema and FAQ data
            if ($object_type === 'product') {
                if (!empty($_POST['hseo_schema_data'])) {
                    $schema_data = json_decode(stripslashes($_POST['hseo_schema_data']), true);
                    if (is_array($schema_data)) {
                        $data['schema_data'] = wp_json_encode($schema_data);
                        $data['schema_type'] = !empty($schema_data['@type']) ? $schema_data['@type'] : 'Product';
                    }
                }
                
                if (!empty($_POST['hseo_faq_data'])) {
                    $faq_data = json_decode(stripslashes($_POST['hseo_faq_data']), true);
                    if (is_array($faq_data)) {
                        $data['faq_data'] = wp_json_encode($faq_data);
                    }
                }
            }
            
            // Check if exists
            $existing = $wpdb->get_var($wpdb->prepare(
                "SELECT id FROM $table_name WHERE object_id = %d AND object_type = %s",
                $object_id,
                $object_type
            ));
            
            if ($existing) {
                $wpdb->update($table_name, $data, array('id' => $existing));
            } else {
                $wpdb->insert($table_name, $data);
            }
        }
        
        /**
         * Render HSEO taxonomy fields
         */
        public function render_hseo_taxonomy_fields($term) {
            global $wpdb;
            $table_name = $wpdb->prefix . 'hseo_data';
            
            $term_id = is_object($term) ? $term->term_id : 0;
            $seo_data = $term_id ? $wpdb->get_row($wpdb->prepare(
                "SELECT * FROM $table_name WHERE object_id = %d AND object_type = 'product_cat'",
                $term_id
            ), ARRAY_A) : null;
            
            $meta_title = $seo_data ? $seo_data['meta_title'] : '';
            $meta_description = $seo_data ? $seo_data['meta_description'] : '';
            $meta_keywords = $seo_data ? $seo_data['meta_keywords'] : '';
            $og_title = $seo_data ? $seo_data['og_title'] : '';
            $og_description = $seo_data ? $seo_data['og_description'] : '';
            $og_image = $seo_data ? $seo_data['og_image'] : '';
            $canonical_url = $seo_data ? $seo_data['canonical_url'] : '';
            $robots_index = $seo_data ? $seo_data['robots_index'] : 'index';
            $robots_follow = $seo_data ? $seo_data['robots_follow'] : 'follow';
            
            if (is_object($term)) {
                // Edit form
                ?>
                <tr class="form-field">
                    <th scope="row"><label for="hseo_meta_title">Meta Title</label></th>
                    <td><input type="text" id="hseo_meta_title" name="hseo_meta_title" value="<?php echo esc_attr($meta_title); ?>" class="regular-text" /></td>
                </tr>
                <tr class="form-field">
                    <th scope="row"><label for="hseo_meta_description">Meta Description</label></th>
                    <td><textarea id="hseo_meta_description" name="hseo_meta_description" rows="3" class="large-text"><?php echo esc_textarea($meta_description); ?></textarea></td>
                </tr>
                <tr class="form-field">
                    <th scope="row"><label for="hseo_meta_keywords">Meta Keywords</label></th>
                    <td><input type="text" id="hseo_meta_keywords" name="hseo_meta_keywords" value="<?php echo esc_attr($meta_keywords); ?>" class="regular-text" /></td>
                </tr>
                <?php
            } else {
                // Add form
                ?>
                <div class="form-field">
                    <label for="hseo_meta_title">Meta Title</label>
                    <input type="text" id="hseo_meta_title" name="hseo_meta_title" value="<?php echo esc_attr($meta_title); ?>" class="regular-text" />
                </div>
                <div class="form-field">
                    <label for="hseo_meta_description">Meta Description</label>
                    <textarea id="hseo_meta_description" name="hseo_meta_description" rows="3" class="large-text"><?php echo esc_textarea($meta_description); ?></textarea>
                </div>
                <div class="form-field">
                    <label for="hseo_meta_keywords">Meta Keywords</label>
                    <input type="text" id="hseo_meta_keywords" name="hseo_meta_keywords" value="<?php echo esc_attr($meta_keywords); ?>" class="regular-text" />
                </div>
                <?php
            }
        }
        
        /**
         * Save HSEO taxonomy meta
         */
        public function save_hseo_taxonomy_meta($term_id) {
            if (!current_user_can('manage_categories')) {
                return;
            }
            
            $this->hseo_save_data($term_id, 'product_cat');
        }
        
        /**
         * Auto-generate Product schema from WooCommerce product
         */
        private function hseo_generate_product_schema($product, $seo_data) {
            $site_url = home_url();
            $product_id = $product->get_id();
            $product_url = $product->get_permalink();
            $product_name = $product->get_name();
            $product_description = wp_strip_all_tags($product->get_description() ?: $product->get_short_description() ?: '');
            $product_sku = $product->get_sku();
            $product_price = $product->get_price();
            $product_currency = get_woocommerce_currency();
            $product_stock_status = $product->get_stock_status();
            $product_images = array();
            
            // Get product images
            $image_id = $product->get_image_id();
            if ($image_id) {
                $image_url = wp_get_attachment_image_url($image_id, 'full');
                if ($image_url) {
                    $product_images[] = $image_url;
                }
            }
            
            $gallery_ids = $product->get_gallery_image_ids();
            foreach ($gallery_ids as $gallery_id) {
                $gallery_url = wp_get_attachment_image_url($gallery_id, 'full');
                if ($gallery_url) {
                    $product_images[] = $gallery_url;
                }
            }
            
            // Get brand if available
            $brand = '';
            $brand_terms = wp_get_post_terms($product_id, 'product_brand', array('fields' => 'names'));
            if (!empty($brand_terms) && !is_wp_error($brand_terms)) {
                $brand = $brand_terms[0];
            }
            
            // Get aggregate rating if available
            $rating_count = $product->get_rating_count();
            $average_rating = $product->get_average_rating();
            
            // Build Product schema
            $schema = array(
                '@context' => 'https://schema.org',
                '@type' => 'Product',
                'name' => $product_name,
                'description' => $product_description,
                'url' => $product_url,
                'image' => !empty($product_images) ? $product_images : array(),
                'sku' => $product_sku ?: null,
            );
            
            // Add brand
            if ($brand) {
                $schema['brand'] = array(
                    '@type' => 'Brand',
                    'name' => $brand,
                );
            }
            
            // Add offer
            if ($product_price > 0) {
                $schema['offers'] = array(
                    '@type' => 'Offer',
                    'priceCurrency' => $product_currency,
                    'price' => $product_price,
                    'availability' => $product_stock_status === 'instock' 
                        ? 'https://schema.org/InStock' 
                        : 'https://schema.org/OutOfStock',
                    'url' => $product_url,
                );
            }
            
            // Add aggregate rating
            if ($rating_count > 0 && $average_rating > 0) {
                $schema['aggregateRating'] = array(
                    '@type' => 'AggregateRating',
                    'ratingValue' => (string) $average_rating,
                    'reviewCount' => (string) $rating_count,
                );
            }
            
            return $schema;
        }
        
        /**
         * Generate BreadcrumbList schema
         */
        private function hseo_generate_breadcrumb_schema($seo_data, $path) {
            $site_url = home_url();
            $breadcrumbs = array(
                array(
                    '@type' => 'ListItem',
                    'position' => 1,
                    'name' => 'Home',
                    'item' => $site_url,
                ),
            );
            
            $position = 2;
            
            if ($seo_data['object_type'] === 'product') {
                $product = wc_get_product($seo_data['object_id']);
                if ($product) {
                    $breadcrumbs[] = array(
                        '@type' => 'ListItem',
                        'position' => $position++,
                        'name' => 'Products',
                        'item' => $site_url . '/products',
                    );
                    $breadcrumbs[] = array(
                        '@type' => 'ListItem',
                        'position' => $position,
                        'name' => $product->get_name(),
                        'item' => $product->get_permalink(),
                    );
                }
            } elseif ($seo_data['object_type'] === 'product_cat') {
                $term = get_term($seo_data['object_id'], 'product_cat');
                if ($term && !is_wp_error($term)) {
                    $breadcrumbs[] = array(
                        '@type' => 'ListItem',
                        'position' => $position++,
                        'name' => 'Categories',
                        'item' => $site_url . '/categories',
                    );
                    $breadcrumbs[] = array(
                        '@type' => 'ListItem',
                        'position' => $position,
                        'name' => $term->name,
                        'item' => get_term_link($term),
                    );
                }
            }
            
            if (count($breadcrumbs) > 1) {
                return array(
                    '@context' => 'https://schema.org',
                    '@type' => 'BreadcrumbList',
                    'itemListElement' => $breadcrumbs,
                );
            }
            
            return null;
        }

        /**
         * Output HSEO meta tags in wp_head (server-side, visible in view source)
         * This ensures SEO data is available even before JavaScript loads
         */
        public function output_hseo_meta_tags() {
            // Only output on frontend, not in admin
            if (is_admin()) {
                return;
            }

            // Get current page path
            $current_path = $this->hseo_get_current_path();
            
            // Get SEO data for current path
            $seo_data = $this->hseo_get_data_by_path($current_path);
            
            // If no SEO data found, try to get homepage SEO or generate defaults
            if (empty($seo_data)) {
                // Check if this is homepage
                if (is_front_page() || is_home()) {
                    $seo_data = $this->hseo_get_homepage_data();
                } else {
                    // Generate default SEO for current page
                    $seo_data = $this->hseo_generate_default_data($current_path);
                }
            }
            
            // If still no data, skip output
            if (empty($seo_data)) {
                return;
            }
            
            // Build SEO response
            $seo_response = $this->hseo_build_response($seo_data, $current_path);
            
            // Output meta tags
            $this->hseo_output_meta_tags($seo_response, $seo_data);
        }

        /**
         * Get current page path for SEO lookup
         */
        private function hseo_get_current_path() {
            // For WordPress pages, try to match product/category first
            if (is_singular('product')) {
                global $post;
                if ($post) {
                    $product = wc_get_product($post->ID);
                    if ($product) {
                        return '/product/' . $product->get_slug();
                    }
                }
            } elseif (is_product_category()) {
                $term = get_queried_object();
                if ($term && isset($term->slug)) {
                    return '/categories/' . $term->slug;
                }
            } elseif (is_front_page() || is_home()) {
                return '/';
            } elseif (is_page() || is_single()) {
                global $post;
                if ($post) {
                    // For regular pages/posts, return the slug
                    return '/' . $post->post_name;
                }
            }
            
            // Fallback: Get request URI
            $request_uri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '';
            
            // Remove query string
            $path = strtok($request_uri, '?');
            
            // Remove leading/trailing slashes and normalize
            $path = trim($path, '/');
            
            // If empty, it's homepage
            if (empty($path)) {
                return '/';
            }
            
            // Return normalized path
            return '/' . $path;
        }

        /**
         * Get homepage SEO data from brand settings
         */
        private function hseo_get_homepage_data() {
            $brand_settings = $this->get_brand_settings();
            
            if (empty($brand_settings['homepage_seo_title']) && empty($brand_settings['homepage_seo_description'])) {
                return null;
            }
            
            $site_url = home_url();
            $site_name = get_bloginfo('name');
            
            return array(
                'object_id' => 0,
                'object_type' => 'homepage',
                'meta_title' => !empty($brand_settings['homepage_seo_title']) ? $brand_settings['homepage_seo_title'] : $site_name,
                'meta_description' => !empty($brand_settings['homepage_seo_description']) ? $brand_settings['homepage_seo_description'] : get_bloginfo('description'),
                'meta_keywords' => '',
                'canonical_url' => $site_url,
                'og_title' => !empty($brand_settings['homepage_seo_title']) ? $brand_settings['homepage_seo_title'] : $site_name,
                'og_description' => !empty($brand_settings['homepage_seo_description']) ? $brand_settings['homepage_seo_description'] : get_bloginfo('description'),
                'og_image' => !empty($brand_settings['homepage_seo_image']) ? $brand_settings['homepage_seo_image'] : '',
                'og_type' => 'website',
                'twitter_card' => 'summary_large_image',
                'robots_index' => 'index',
                'robots_follow' => 'follow',
                'schema_data' => '',
                'faq_data' => '',
            );
        }

        /**
         * Generate default SEO data for a page when no custom SEO is set
         */
        private function hseo_generate_default_data($path) {
            $site_url = home_url();
            $site_name = get_bloginfo('name');
            
            // Try to extract object info from path
            $path_parts = explode('/', trim($path, '/'));
            
            if (count($path_parts) >= 2 && $path_parts[0] === 'product') {
                // Product page
                $slug = $path_parts[1];
                $product = get_page_by_path($slug, OBJECT, 'product');
                if ($product) {
                    $wc_product = wc_get_product($product->ID);
                    if ($wc_product) {
                        $title = $wc_product->get_name() . ' - ' . $site_name;
                        $description = wp_trim_words(strip_tags($wc_product->get_short_description() ?: $wc_product->get_description()), 25);
                        if (empty($description)) {
                            $description = sprintf(__('Buy %s at %s', $this->text_domain), $wc_product->get_name(), $site_name);
                        }
                        
                        $image_id = $wc_product->get_image_id();
                        $og_image = '';
                        if ($image_id) {
                            $image_url = wp_get_attachment_image_url($image_id, 'full');
                            if ($image_url) {
                                $og_image = $image_url;
                            }
                        }
                        
                        return array(
                            'object_id' => $product->ID,
                            'object_type' => 'product',
                            'meta_title' => $title,
                            'meta_description' => $description,
                            'meta_keywords' => '',
                            'canonical_url' => $site_url . $path,
                            'og_title' => $title,
                            'og_description' => $description,
                            'og_image' => $og_image,
                            'og_type' => 'product',
                            'twitter_card' => 'summary_large_image',
                            'robots_index' => 'index',
                            'robots_follow' => 'follow',
                            'schema_data' => '',
                            'faq_data' => '',
                        );
                    }
                }
            } elseif (count($path_parts) >= 2 && $path_parts[0] === 'categories') {
                // Category page
                $slug = $path_parts[1];
                $term = get_term_by('slug', $slug, 'product_cat');
                if ($term && !is_wp_error($term)) {
                    $title = $term->name . ' - ' . $site_name;
                    $description = wp_trim_words(strip_tags($term->description), 25);
                    if (empty($description)) {
                        $description = sprintf(__('Browse %s products at %s', $this->text_domain), $term->name, $site_name);
                    }
                    
                    return array(
                        'object_id' => $term->term_id,
                        'object_type' => 'product_cat',
                        'meta_title' => $title,
                        'meta_description' => $description,
                        'meta_keywords' => '',
                        'canonical_url' => $site_url . $path,
                        'og_title' => $title,
                        'og_description' => $description,
                        'og_image' => '',
                        'og_type' => 'website',
                        'twitter_card' => 'summary_large_image',
                        'robots_index' => 'index',
                        'robots_follow' => 'follow',
                        'schema_data' => '',
                        'faq_data' => '',
                    );
                }
            }
            
            // Default fallback
            return array(
                'object_id' => 0,
                'object_type' => 'page',
                'meta_title' => $site_name,
                'meta_description' => get_bloginfo('description'),
                'meta_keywords' => '',
                'canonical_url' => $site_url . $path,
                'og_title' => $site_name,
                'og_description' => get_bloginfo('description'),
                'og_image' => '',
                'og_type' => 'website',
                'twitter_card' => 'summary_large_image',
                'robots_index' => 'index',
                'robots_follow' => 'follow',
                'schema_data' => '',
                'faq_data' => '',
            );
        }

        /**
         * Output all SEO meta tags to wp_head
         */
        private function hseo_output_meta_tags($seo_response, $seo_data) {
            $site_url = home_url();
            $site_name = get_bloginfo('name');
            
            // Ensure all values are set
            $title = !empty($seo_response['title']) ? esc_attr($seo_response['title']) : $site_name;
            $description = !empty($seo_response['description']) ? esc_attr($seo_response['description']) : get_bloginfo('description');
            $keywords = !empty($seo_response['keywords']) ? esc_attr($seo_response['keywords']) : '';
            $canonical = !empty($seo_response['canonical']) ? esc_url($seo_response['canonical']) : ($site_url . $this->hseo_get_current_path());
            
            // Ensure canonical is absolute
            if ($canonical && !preg_match('/^https?:\/\//', $canonical)) {
                $canonical = $site_url . (strpos($canonical, '/') === 0 ? '' : '/') . ltrim($canonical, '/');
            }
            
            // Open Graph
            $og_title = !empty($seo_response['og_title']) ? esc_attr($seo_response['og_title']) : $title;
            $og_description = !empty($seo_response['og_description']) ? esc_attr($seo_response['og_description']) : $description;
            $og_image = !empty($seo_response['og_image']) ? esc_url($seo_response['og_image']) : '';
            // Ensure OG image is absolute
            if ($og_image && !preg_match('/^https?:\/\//', $og_image)) {
                $og_image = $site_url . (strpos($og_image, '/') === 0 ? '' : '/') . ltrim($og_image, '/');
            }
            $og_url = !empty($seo_response['og_url']) ? esc_url($seo_response['og_url']) : $canonical;
            $og_type = !empty($seo_response['og_type']) ? esc_attr($seo_response['og_type']) : 'website';
            $og_site_name = !empty($seo_response['og_site_name']) ? esc_attr($seo_response['og_site_name']) : $site_name;
            
            // Twitter Card
            $twitter_card = !empty($seo_response['twitter_card']) ? esc_attr($seo_response['twitter_card']) : 'summary_large_image';
            $twitter_title = !empty($seo_response['twitter_title']) ? esc_attr($seo_response['twitter_title']) : $og_title;
            $twitter_description = !empty($seo_response['twitter_description']) ? esc_attr($seo_response['twitter_description']) : $og_description;
            $twitter_image = !empty($seo_response['twitter_image']) ? esc_url($seo_response['twitter_image']) : $og_image;
            // Ensure Twitter image is absolute
            if ($twitter_image && !preg_match('/^https?:\/\//', $twitter_image)) {
                $twitter_image = $site_url . (strpos($twitter_image, '/') === 0 ? '' : '/') . ltrim($twitter_image, '/');
            }
            
            // Robots
            $robots = !empty($seo_response['robots']) ? esc_attr($seo_response['robots']) : 'index, follow';
            
            // Output meta tags
            echo "\n<!-- Headless SEO (HSEO) Meta Tags -->\n";
            
            // Title tag
            echo '<title>' . $title . '</title>' . "\n";
            
            // Basic meta tags
            echo '<meta name="description" content="' . $description . '" />' . "\n";
            if (!empty($keywords)) {
                echo '<meta name="keywords" content="' . $keywords . '" />' . "\n";
            }
            echo '<meta name="robots" content="' . $robots . '" />' . "\n";
            
            // Canonical URL
            if ($canonical) {
                echo '<link rel="canonical" href="' . $canonical . '" />' . "\n";
            }
            
            // Open Graph tags
            echo '<meta property="og:title" content="' . $og_title . '" />' . "\n";
            echo '<meta property="og:description" content="' . $og_description . '" />' . "\n";
            if ($og_image) {
                echo '<meta property="og:image" content="' . $og_image . '" />' . "\n";
                // Add OG image dimensions if available
                if (function_exists('wp_get_attachment_metadata')) {
                    $attachment_id = attachment_url_to_postid($og_image);
                    if ($attachment_id) {
                        $metadata = wp_get_attachment_metadata($attachment_id);
                        if ($metadata && isset($metadata['width']) && isset($metadata['height'])) {
                            echo '<meta property="og:image:width" content="' . intval($metadata['width']) . '" />' . "\n";
                            echo '<meta property="og:image:height" content="' . intval($metadata['height']) . '" />' . "\n";
                        }
                    }
                }
            }
            echo '<meta property="og:url" content="' . $og_url . '" />' . "\n";
            echo '<meta property="og:type" content="' . $og_type . '" />' . "\n";
            echo '<meta property="og:site_name" content="' . $og_site_name . '" />' . "\n";
            echo '<meta property="og:locale" content="' . esc_attr(get_locale()) . '" />' . "\n";
            
            // Twitter Card tags
            echo '<meta name="twitter:card" content="' . $twitter_card . '" />' . "\n";
            echo '<meta name="twitter:title" content="' . $twitter_title . '" />' . "\n";
            echo '<meta name="twitter:description" content="' . $twitter_description . '" />' . "\n";
            if ($twitter_image) {
                echo '<meta name="twitter:image" content="' . $twitter_image . '" />' . "\n";
            }
            
            // Additional SEO meta tags
            echo '<meta name="author" content="' . esc_attr($site_name) . '" />' . "\n";
            echo '<meta name="generator" content="Headless Proxy Manager" />' . "\n";
            
            // Output JSON-LD structured data
            if (!empty($seo_response['json_ld']) && is_array($seo_response['json_ld'])) {
                foreach ($seo_response['json_ld'] as $json_ld) {
                    if (!empty($json_ld)) {
                        echo '<script type="application/ld+json">' . "\n";
                        echo wp_json_encode($json_ld, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
                        echo "\n" . '</script>' . "\n";
                    }
                }
            }
            
            // Add Organization schema if not already present
            $has_organization = false;
            if (!empty($seo_response['json_ld']) && is_array($seo_response['json_ld'])) {
                foreach ($seo_response['json_ld'] as $schema) {
                    if (isset($schema['@type']) && $schema['@type'] === 'Organization') {
                        $has_organization = true;
                        break;
                    }
                }
            }
            
            if (!$has_organization) {
                $organization_schema = $this->hseo_generate_organization_schema();
                if ($organization_schema) {
                    echo '<script type="application/ld+json">' . "\n";
                    echo wp_json_encode($organization_schema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
                    echo "\n" . '</script>' . "\n";
                }
            }
            
            // Add Website schema for homepage
            if (is_front_page() || is_home()) {
                $website_schema = $this->hseo_generate_website_schema();
                if ($website_schema) {
                    echo '<script type="application/ld+json">' . "\n";
                    echo wp_json_encode($website_schema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
                    echo "\n" . '</script>' . "\n";
                }
            }
            
            // Add Article schema for blog posts
            if (is_single() && get_post_type() === 'post') {
                $article_schema = $this->hseo_generate_article_schema();
                if ($article_schema) {
                    echo '<script type="application/ld+json">' . "\n";
                    echo wp_json_encode($article_schema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
                    echo "\n" . '</script>' . "\n";
                }
            }
            
            // Add hreflang tags for multilingual support (if WPML or Polylang is active)
            $this->hseo_output_hreflang_tags($canonical);
            
            echo "<!-- /Headless SEO (HSEO) Meta Tags -->\n\n";
        }

        /**
         * Output hreflang tags for multilingual support
         */
        private function hseo_output_hreflang_tags($canonical) {
            // Check if WPML is active
            if (function_exists('icl_get_languages')) {
                $languages = icl_get_languages('skip_missing=0');
                if (!empty($languages)) {
                    foreach ($languages as $lang) {
                        if (!empty($lang['url'])) {
                            echo '<link rel="alternate" hreflang="' . esc_attr($lang['language_code']) . '" href="' . esc_url($lang['url']) . '" />' . "\n";
                        }
                    }
                    // Add x-default
                    $default_lang = apply_filters('wpml_default_language', null);
                    if ($default_lang && isset($languages[$default_lang])) {
                        echo '<link rel="alternate" hreflang="x-default" href="' . esc_url($languages[$default_lang]['url']) . '" />' . "\n";
                    }
                }
            }
            // Check if Polylang is active
            elseif (function_exists('pll_the_languages')) {
                $languages = pll_the_languages(array('raw' => 1));
                if (!empty($languages)) {
                    foreach ($languages as $lang) {
                        if (!empty($lang['url'])) {
                            echo '<link rel="alternate" hreflang="' . esc_attr($lang['slug']) . '" href="' . esc_url($lang['url']) . '" />' . "\n";
                        }
                    }
                }
            }
        }

        /**
         * Generate Article schema for blog posts
         */
        private function hseo_generate_article_schema() {
            if (!is_single() || get_post_type() !== 'post') {
                return null;
            }
            
            global $post;
            $site_url = home_url();
            $site_name = get_bloginfo('name');
            
            $schema = array(
                '@context' => 'https://schema.org',
                '@type' => 'Article',
                'headline' => get_the_title(),
                'url' => get_permalink(),
                'datePublished' => get_the_date('c'),
                'dateModified' => get_the_modified_date('c'),
                'author' => array(
                    '@type' => 'Person',
                    'name' => get_the_author(),
                ),
                'publisher' => array(
                    '@type' => 'Organization',
                    'name' => $site_name,
                    'url' => $site_url,
                ),
            );
            
            // Add featured image
            $thumbnail_id = get_post_thumbnail_id();
            if ($thumbnail_id) {
                $image_url = wp_get_attachment_image_url($thumbnail_id, 'full');
                if ($image_url) {
                    $schema['image'] = array(
                        '@type' => 'ImageObject',
                        'url' => $image_url,
                    );
                }
            }
            
            // Add description
            $excerpt = get_the_excerpt();
            if ($excerpt) {
                $schema['description'] = wp_trim_words(strip_tags($excerpt), 30);
            }
            
            return $schema;
        }

        /**
         * Generate Organization schema
         */
        private function hseo_generate_organization_schema() {
            $site_url = home_url();
            $site_name = get_bloginfo('name');
            $site_description = get_bloginfo('description');
            
            $schema = array(
                '@context' => 'https://schema.org',
                '@type' => 'Organization',
                'name' => $site_name,
                'url' => $site_url,
            );
            
            if ($site_description) {
                $schema['description'] = $site_description;
            }
            
            // Try to get logo from customizer or site icon
            $logo_id = get_theme_mod('custom_logo') ?: get_option('site_icon');
            if ($logo_id) {
                $logo_url = wp_get_attachment_image_url($logo_id, 'full');
                if ($logo_url) {
                    $schema['logo'] = $logo_url;
                }
            }
            
            // Add social profiles if available
            $social_profiles = array();
            // You can extend this to read from theme options or customizer
            if (!empty($social_profiles)) {
                $schema['sameAs'] = $social_profiles;
            }
            
            return $schema;
        }

        /**
         * Generate Website schema for homepage
         */
        private function hseo_generate_website_schema() {
            $site_url = home_url();
            $site_name = get_bloginfo('name');
            
            $schema = array(
                '@context' => 'https://schema.org',
                '@type' => 'WebSite',
                'name' => $site_name,
                'url' => $site_url,
            );
            
            // Add potential action (search action) if search is available
            if (function_exists('get_search_form')) {
                $schema['potentialAction'] = array(
                    '@type' => 'SearchAction',
                    'target' => array(
                        '@type' => 'EntryPoint',
                        'urlTemplate' => $site_url . '/?s={search_term_string}',
                    ),
                    'query-input' => 'required name=search_term_string',
                );
            }
            
            return $schema;
        }

        private function build_wc_url($endpoint) {
            $endpoint = '/' . ltrim($endpoint, '/');
            $endpoint = preg_replace('#//+#', '/', $endpoint);
            $options = get_option($this->option_name, array());
            $base = !empty($options['store_base_url']) ? rtrim($options['store_base_url'], '/') : '';
            if ($base) {
                return $base . '/wp-json/wc/v3' . $endpoint;
            } else {
                return rest_url('wc/v3' . $endpoint);
            }
        }

        private function get_basic_auth_header($ck, $cs) {
            return 'Basic ' . base64_encode($ck . ':' . $cs);
        }

        private function encode_json($data) {
            return wp_json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        }

        // Clear HPM transients and object cache
        public function clear_proxy_cache() {
            global $wpdb;
            // Delete transients starting with hpm_cache_
            $like1 = $wpdb->esc_like('_transient_hpm_cache_') . '%';
            $like2 = $wpdb->esc_like('_transient_timeout_hpm_cache_') . '%';
            $wpdb->query($wpdb->prepare("DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s", $like1, $like2));
            // Flush object cache if available
            if (function_exists('wp_cache_flush')) wp_cache_flush();
            return true;
        }

        // Adds Access-Control-Allow & Expose headers for our namespace
        public function add_cors_and_security_headers($served, $result, $request, $server) {
            $route = $request->get_route();
            $ns = hpm_get_api_namespace();
            $prefix = '/' . $ns . '/';
            if (strpos($route, $prefix) === 0) {
                header('Access-Control-Allow-Origin: *');
                header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
                header('Access-Control-Allow-Headers: Content-Type, Accept, X-HPM-Secret, x-hpm-secret, Authorization, X-Requested-With, X-WP-Nonce');
                header('Access-Control-Expose-Headers: X-WP-Total, X-WP-TotalPages');
                header('Access-Control-Allow-Credentials: false');
                header('Access-Control-Max-Age: 86400');
                header('X-Content-Type-Options: nosniff');
                header('X-Frame-Options: DENY');
                header('X-XSS-Protection: 1; mode=block');
            }
            return $served;
        }

        // Inline CSS variables for brand settings
        public function output_brand_css() {
            $brand = $this->get_brand_settings();
            $primary = esc_attr($brand['primary_color']);
            $secondary = esc_attr($brand['secondary_color']);
            $font = esc_attr($brand['brand_font']);
            echo "<style id='hpm-brand-vars'>:root{--hpm-primary: {$primary};--hpm-secondary: {$secondary};--hpm-font: {$font};} body{font-family: var(--hpm-font, inherit);} .hpm-brand-primary{color: var(--hpm-primary);} .hpm-brand-secondary{color: var(--hpm-secondary);} .hpm-brand-bg-primary{background-color: var(--hpm-primary); color: #fff;} .hpm-brand-bg-secondary{background-color: var(--hpm-secondary); color: #fff;}</style>";
        }

        /** PROXY: handle requests, cache and forward upstream headers **/
        public function handle_proxy_request($request) {
            $start_time = microtime(true);
            $endpoint = '';
            $method = 'GET';
            try {
                // Get parameters from query string first, then fall back to JSON body
                $endpoint = $request->get_param('endpoint');
                $params = $request->get_param('params');
                $method = $request->get_param('method');
                
                // If not in query params, check JSON body
                if (empty($endpoint)) {
                    $body = $request->get_json_params();
                    if (is_array($body)) {
                        $endpoint = $body['endpoint'] ?? '';
                        if (empty($params) || !is_array($params)) {
                            $params = $body['params'] ?? array();
                        }
                        if (empty($method)) {
                            $method = $body['method'] ?? 'GET';
                        }
                    }
                }
                
                // Sanitize and validate
                $endpoint = sanitize_text_field($endpoint);
                if (empty($endpoint)) {
                    return new WP_Error('missing_endpoint', __('Endpoint parameter is required', $this->text_domain), array('status' => 400));
                }
                
                $params = is_array($params) ? $params : array();
                $method = strtoupper($method ?: 'GET');
                
                if (!in_array($method, array('GET','POST','PUT','DELETE'), true)) {
                    return new WP_Error('invalid_method', __('Invalid HTTP method', $this->text_domain), array('status' => 400));
                }
                if (!$this->check_rate_limit()) {
                    return new WP_Error('rate_limit_exceeded', __('Rate limit exceeded', $this->text_domain), array('status' => 429));
                }
                if (!$this->is_valid_endpoint($endpoint)) {
                    $this->log_request($endpoint, $method, 403, $_SERVER['REMOTE_ADDR'], microtime(true) - $start_time);
                    return new WP_Error('invalid_endpoint', __('Invalid endpoint requested', $this->text_domain), array('status' => 400));
                }
                $ck = $this->get_wc_consumer_key();
                $cs = $this->get_wc_consumer_secret();
                if (!$ck || !$cs) {
                    $this->log_request($endpoint, $method, 500, $_SERVER['REMOTE_ADDR'], microtime(true) - $start_time);
                    return new WP_Error('missing_credentials', __('WooCommerce API credentials not configured.', $this->text_domain), array('status' => 500));
                }
                if (strpos($ck,'ck_') !== 0 || strpos($cs,'cs_') !== 0) {
                    $this->log_request($endpoint, $method, 500, $_SERVER['REMOTE_ADDR'], microtime(true) - $start_time);
                    return new WP_Error('invalid_credentials', __('WooCommerce API credentials appear to be invalid.', $this->text_domain), array('status' => 500));
                }
                $wc_api_url = $this->build_wc_url($endpoint);
                
                // Optimize: Add field filtering for products list endpoint to reduce payload
                // Only filter for list endpoints, not single product detail pages (e.g., /products/123)
                $is_products_list = (strpos($endpoint, '/products') === 0 && preg_match('#^/products/\d+$#', $endpoint) === 0);
                if ($is_products_list && empty($params['_fields'])) {
                    // Only return essential fields for list views (not single product detail)
                    $params['_fields'] = 'id,name,slug,permalink,type,status,featured,price,regular_price,sale_price,price_html,on_sale,images,categories,tags,average_rating,rating_count,stock_status,sku,meta_data';
                }
                
                $headers = array(
                    'Content-Type' => 'application/json',
                    'Accept' => 'application/json',
                    'User-Agent' => 'Headless-Proxy-Manager/1.1.0',
                    'Authorization' => $this->get_basic_auth_header($ck, $cs),
                );
                $options = get_option($this->option_name, array());
                
                // Optimize: Longer cache for search results and list views, shorter for dynamic data
                $is_search = !empty($params['search']);
                $search_term = $is_search ? sanitize_text_field($params['search'] ?? '') : '';
                // Search results: 5 minutes cache, List views: use configured TTL (default 15s), Single product: shorter cache
                $is_single_product = preg_match('#^/products/\d+$#', $endpoint) === 1;
                if ($is_search) {
                    $cache_ttl = 300; // 5 minutes for search
                } elseif ($is_single_product) {
                    $cache_ttl = isset($options['cache_ttl']) ? absint($options['cache_ttl']) : 15; // Default cache for single products
                } else {
                    $cache_ttl = isset($options['cache_ttl']) ? absint($options['cache_ttl']) : 60; // Longer cache for list views (60s default)
                }
                
                // Transient cache key (include search query in key for better cache hits)
                $cache_key = 'hpm_cache_' . md5($method . '|' . $endpoint . '|' . maybe_serialize($params));
                if ($cache_ttl > 0) {
                    $cached = get_transient($cache_key);
                    if ($cached && is_array($cached) && isset($cached['body'])) {
                        // Return cached response with headers
                        $this->log_request($endpoint, $method, 200, $_SERVER['REMOTE_ADDR'], microtime(true) - $start_time);
                        $resp = new WP_REST_Response($cached['body'], 200);
                        if (!empty($cached['headers']['X-WP-Total'])) $resp->header('X-WP-Total', $cached['headers']['X-WP-Total']);
                        if (!empty($cached['headers']['X-WP-TotalPages'])) $resp->header('X-WP-TotalPages', $cached['headers']['X-WP-TotalPages']);
                        return $resp;
                    }
                }
                // Optimize: For search queries, use custom name-only search via WP_Query
                if ($is_search && !empty($search_term) && $is_products_list) {
                    $search_results = $this->search_products_by_name_only($search_term, $params);
                    if ($search_results !== false) {
                        // Use custom search results
                        $data = $search_results['products'];
                        $up_total = $search_results['total'];
                        $per_page = isset($params['per_page']) ? absint($params['per_page']) : 10;
                        $up_total_pages = ceil($up_total / $per_page);
                        $code = 200;
                        $json_error = null;
                    } else {
                        // Fallback to regular WooCommerce API search
                        $timeout = 10;
                        $args = array('method' => $method, 'headers' => $headers, 'timeout' => $timeout, 'data_format' => 'body');
                        if ($is_search && empty($params['orderby'])) {
                            $params['orderby'] = 'title';
                            $params['order'] = 'asc';
                        }
                        if ($method === 'GET') {
                            if (!empty($params)) $wc_api_url = add_query_arg($params, $wc_api_url);
                            $response = wp_remote_get($wc_api_url, $args);
                        } else {
                            if (!empty($params)) $args['body'] = $this->encode_json($params);
                            $response = wp_remote_request($wc_api_url, $args);
                        }
                        if (is_wp_error($response)) {
                            $this->log_request($endpoint, $method, 500, $_SERVER['REMOTE_ADDR'], microtime(true) - $start_time);
                            return new WP_Error('api_error', __('WooCommerce API request failed: ', $this->text_domain) . $response->get_error_message(), array('status' => 500));
                        }
                        $code = wp_remote_retrieve_response_code($response);
                        $body = wp_remote_retrieve_body($response);
                        $this->log_request($endpoint, $method, $code, $_SERVER['REMOTE_ADDR'], microtime(true) - $start_time);
                        $data = null;
                        $json_error = null;
                        if ($body !== '') {
                            $data = json_decode($body, true);
                            if (json_last_error() !== JSON_ERROR_NONE) $json_error = json_last_error_msg();
                        }
                        $up_total = wp_remote_retrieve_header($response, 'x-wp-total');
                        $up_total_pages = wp_remote_retrieve_header($response, 'x-wp-totalpages');
                    }
                } else {
                    // Non-search requests use normal flow
                    $timeout = $is_search ? 10 : 30;
                    $args = array('method' => $method, 'headers' => $headers, 'timeout' => $timeout, 'data_format' => 'body');
                    
                    if ($method === 'GET') {
                        if (!empty($params)) $wc_api_url = add_query_arg($params, $wc_api_url);
                        $response = wp_remote_get($wc_api_url, $args);
                    } else {
                        if (!empty($params)) $args['body'] = $this->encode_json($params);
                        $response = wp_remote_request($wc_api_url, $args);
                    }
                    if (is_wp_error($response)) {
                        $this->log_request($endpoint, $method, 500, $_SERVER['REMOTE_ADDR'], microtime(true) - $start_time);
                        return new WP_Error('api_error', __('WooCommerce API request failed: ', $this->text_domain) . $response->get_error_message(), array('status' => 500));
                    }
                    $code = wp_remote_retrieve_response_code($response);
                    $body = wp_remote_retrieve_body($response);
                    $this->log_request($endpoint, $method, $code, $_SERVER['REMOTE_ADDR'], microtime(true) - $start_time);
                    $data = null;
                    $json_error = null;
                    if ($body !== '') {
                        $data = json_decode($body, true);
                        if (json_last_error() !== JSON_ERROR_NONE) $json_error = json_last_error_msg();
                    }
                    $up_total = wp_remote_retrieve_header($response, 'x-wp-total');
                    $up_total_pages = wp_remote_retrieve_header($response, 'x-wp-totalpages');
                }
                
                // Process response
                if ($code >= 200 && $code < 300) {
                    if ($json_error) {
                        error_log('Woo API non-JSON success for '.$endpoint.': '.substr($body,0,500));
                        return new WP_Error('json_error', __('Invalid JSON response from WooCommerce API', $this->text_domain), array('status' => 500));
                    }
                    
                    // Optimize: Filter out unnecessary fields if not already filtered by WooCommerce
                    if ($is_products_list && is_array($data)) {
                        $data = $this->filter_product_fields($data, !empty($params['_fields']));
                    }
                    
                    // Ensure count field is present and correct for categories endpoint
                    if (strpos($endpoint, '/products/categories') === 0 && is_array($data)) {
                        $data = $this->ensure_category_counts($data);
                    }
                    
                    // cache response body + relevant headers
                    if ($cache_ttl > 0) {
                        $cache_payload = array('body' => $data, 'headers' => array());
                        if (!empty($up_total)) $cache_payload['headers']['X-WP-Total'] = $up_total;
                        if (!empty($up_total_pages)) $cache_payload['headers']['X-WP-TotalPages'] = $up_total_pages;
                        set_transient($cache_key, $cache_payload, $cache_ttl);
                    }
                    $resp = new WP_REST_Response($data, $code);
                    if (!empty($up_total)) $resp->header('X-WP-Total', $up_total);
                    if (!empty($up_total_pages)) $resp->header('X-WP-TotalPages', $up_total_pages);
                    return $resp;
                } else {
                    if ($json_error) {
                        error_log('Woo API error (non-JSON) '.$code.' for '.$endpoint.': '.substr($body,0,500));
                        return new WP_Error('api_error', __('WooCommerce API request failed: ', $this->text_domain) . $code . ' - Non-JSON response', array('status' => $code));
                    }
                    $msg = isset($data['message']) ? $data['message'] : 'Unknown error';
                    $code_name = isset($data['code']) ? $data['code'] : 'api_error';
                    error_log('Woo API error '.$code.' '.$endpoint.': '.json_encode($data));
                    return new WP_Error($code_name, __('WooCommerce API request failed: ', $this->text_domain) . $msg, array('status' => $code));
                }
            } catch (Exception $e) {
                $this->log_request($endpoint ?: '', $method ?: 'UNKNOWN', 500, $_SERVER['REMOTE_ADDR'], microtime(true) - $start_time);
                error_log('Proxy Exception: '.$e->getMessage().' @ '.$e->getFile().':'.$e->getLine());
                return new WP_Error('proxy_error', __('Proxy request failed: ', $this->text_domain) . $e->getMessage(), array('status' => 500));
            }
        }

        /**
         * Create order and trigger gateway process_payment to receive redirect_url
         */
        public function handle_checkout_session($request) {
            if (!function_exists('wc_create_order')) {
                return new WP_Error('woocommerce_missing', 'WooCommerce not loaded', array('status' => 500));
            }

            $payload = $request->get_json_params();
            if (empty($payload)) {
                return new WP_Error('invalid_payload', 'No checkout data received', array('status' => 400));
            }

            $errors = $this->validate_order_data($payload);
            if (!empty($errors)) {
                return new WP_Error('invalid_order_data', implode(', ', $errors), array('status' => 400));
            }

            $defaults = $this->get_store_defaults();

            try {
                $order = wc_create_order();

                if (!empty($payload['customer_id'])) {
                    $order->set_customer_id(absint($payload['customer_id']));
                }

                // Line items
                if (!empty($payload['line_items'])) {
                    foreach ($payload['line_items'] as $item) {
                        $product_id = absint($item['product_id']);
                        $variation_id = absint($item['variation_id'] ?? 0);
                        $qty = max(1, absint($item['quantity'] ?? 1));
                        $order->add_product($variation_id ? wc_get_product($variation_id) : wc_get_product($product_id), $qty);
                    }
                }

                // Billing / Shipping
                $billing = $payload['billing'] ?? array();
                $shipping = $payload['shipping'] ?? array();
                $order->set_address(array_merge(array(
                    'first_name' => '',
                    'last_name' => '',
                    'company' => '',
                    'address_1' => '',
                    'address_2' => '',
                    'city' => '',
                    'state' => $defaults['state'],
                    'postcode' => '',
                    'country' => $defaults['country'],
                    'email' => '',
                    'phone' => ''
                ), $billing), 'billing');
                $order->set_address(array_merge(array(
                    'first_name' => '',
                    'last_name' => '',
                    'company' => '',
                    'address_1' => '',
                    'address_2' => '',
                    'city' => '',
                    'state' => $defaults['state'],
                    'postcode' => '',
                    'country' => $defaults['country'],
                    'phone' => ''
                ), $shipping), 'shipping');

                // Shipping lines
                if (!empty($payload['shipping_lines'])) {
                    foreach ($this->sanitize_shipping_lines_for_rest($payload['shipping_lines']) as $ship) {
                        $item = new WC_Order_Item_Shipping();
                        $item->set_method_title(sanitize_text_field($ship['method_title'] ?? 'Shipping'));
                        $item->set_method_id(sanitize_text_field($ship['method_id'] ?? 'flat_rate'));
                        $item->set_total(wc_format_decimal($ship['total'] ?? 0));
                        $order->add_item($item);
                    }
                }

                // Coupons
                if (!empty($payload['coupon_lines'])) {
                    foreach ($payload['coupon_lines'] as $c) {
                        $code = sanitize_text_field($c['code'] ?? '');
                        if ($code) {
                            $order->apply_coupon($code);
                        }
                    }
                }

                $order->set_currency($payload['currency'] ?? $defaults['currency']);

                // Payment method
                $gateway_id = sanitize_text_field($payload['payment_method'] ?? '');
                $gateway = $this->get_wc_gateway_by_id($gateway_id);
                if (!$gateway) {
                    return new WP_Error('invalid_gateway', 'Payment gateway not found', array('status' => 400));
                }
                $order->set_payment_method($gateway);

                $order->calculate_totals();
                $order->save();

                $result = $gateway->process_payment($order->get_id());

                if (is_array($result) && !empty($result['result']) && $result['result'] === 'success') {
                    return array(
                        'order_id' => $order->get_id(),
                        'redirect_url' => $result['redirect'] ?? '',
                        'result' => $result['result'],
                    );
                }

                return new WP_Error('payment_failed', 'Payment initiation failed', array('status' => 400, 'data' => $result));
            } catch (Exception $e) {
                return new WP_Error('checkout_error', $e->getMessage(), array('status' => 500));
            }
        }

        public function handle_clear_cache($request) {
            if (!current_user_can('manage_options')) {
                // allow secret auth as well
                $secret = $request->get_header('x-hpm-secret') ?: $request->get_header('X-HPM-Secret');
                if (empty($secret) || $secret !== $this->get_proxy_secret()) {
                    return new WP_Error('forbidden', 'Not authorized', array('status' => 403));
                }
            }
            $this->clear_proxy_cache();
            return array('success' => true, 'message' => 'HPM cache cleared');
        }

        public function maybe_handle_quick_clear() {
            if (!is_admin()) return;
            if (isset($_GET['hpm_clear_cache']) && current_user_can('manage_options') && check_admin_referer('hpm_clear_cache')) {
                $this->clear_proxy_cache();
                wp_safe_redirect(remove_query_arg(array('hpm_clear_cache','_wpnonce')));
                exit;
            }
        }

        public function add_admin_bar_clear_cache_button($wp_admin_bar) {
            if (!current_user_can('manage_options')) return;
            $args = array(
                'id' => 'hpm-clear-cache',
                'title' => 'Clear HPM Cache',
                'href' => wp_nonce_url(admin_url('?hpm_clear_cache=1'), 'hpm_clear_cache'),
                'meta' => array('class' => 'hpm-clear-cache')
            );
            $wp_admin_bar->add_node($args);
        }

        /** ========== ORDER CREATION ========== */
        public function handle_order_creation($request) {
            $start_time = microtime(true);

            try {
                $payload = $request->get_json_params();
                if (empty($payload)) {
                    return new WP_Error('invalid_payload', 'No order data received', array('status' => 400));
                }

                // Ensure required fields exist
                $errors = $this->validate_order_data($payload);
                if (!empty($errors)) {
                    return new WP_Error('invalid_order_data', implode(', ', $errors), array('status' => 400));
                }

                // Fill defaults from WooCommerce settings if missing
                $defaults = $this->get_store_defaults();
                $payload['currency'] = $payload['currency'] ?? $defaults['currency'];
                // Fix shipping_lines to pass REST validation
                if (!empty($payload['shipping_lines'])) {
                    $payload['shipping_lines'] = $this->sanitize_shipping_lines_for_rest($payload['shipping_lines']);
                }

                // Normalize billing/shipping countries/states
                if (!empty($payload['billing']) && is_array($payload['billing'])) {
                    $payload['billing']['country'] = $payload['billing']['country'] ?? $defaults['country'];
                    $payload['billing']['state'] = $payload['billing']['state'] ?? $defaults['state'];
                }
                if (!empty($payload['shipping']) && is_array($payload['shipping'])) {
                    $payload['shipping']['country'] = $payload['shipping']['country'] ?? $defaults['country'];
                    $payload['shipping']['state'] = $payload['shipping']['state'] ?? $defaults['state'];
                }

                // Ensure customer_id is set and valid
                if (!empty($payload['customer_id'])) {
                    $payload['customer_id'] = absint($payload['customer_id']);
                } elseif (!empty($payload['billing']['email'])) {
                    // Try to find customer by email if not provided
                    $user = get_user_by('email', $payload['billing']['email']);
                    if ($user) {
                        $payload['customer_id'] = $user->ID;
                    }
                }

                // Forward the payload directly to WooCommerce Orders REST API
                $endpoint = '/orders';
                $wc_api_url = $this->build_wc_url($endpoint);
                $ck = $this->get_wc_consumer_key();
                $cs = $this->get_wc_consumer_secret();
                if (!$ck || !$cs) {
                    return new WP_Error('missing_credentials', __('WooCommerce API credentials not configured.', $this->text_domain), array('status' => 500));
                }
                if (strpos($ck,'ck_') !== 0 || strpos($cs,'cs_') !== 0) {
                    return new WP_Error('invalid_credentials', __('WooCommerce API credentials appear to be invalid.', $this->text_domain), array('status' => 500));
                }

                $headers = array(
                    'Content-Type' => 'application/json',
                    'Accept' => 'application/json',
                    'User-Agent' => 'Headless-Proxy-Manager/1.1.0',
                    'Authorization' => $this->get_basic_auth_header($ck, $cs),
                );

                $args = array(
                    'method'  => 'POST',
                    'headers' => $headers,
                    'timeout' => 30,
                    'body'    => $this->encode_json($payload),
                );

                $response = wp_remote_post($wc_api_url, $args);
                if (is_wp_error($response)) {
                    $this->log_request($endpoint, 'POST', 500, $_SERVER['REMOTE_ADDR'], microtime(true) - $start_time);
                    return new WP_Error('api_error', __('WooCommerce API request failed: ', $this->text_domain) . $response->get_error_message(), array('status' => 500));
                }

                $code = wp_remote_retrieve_response_code($response);
                $body = wp_remote_retrieve_body($response);
                $data = null;
                $json_error = null;
                if ($body !== '') {
                    $data = json_decode($body, true);
                    if (json_last_error() !== JSON_ERROR_NONE) $json_error = json_last_error_msg();
                }

                $this->log_request($endpoint, 'POST', $code, $_SERVER['REMOTE_ADDR'], microtime(true) - $start_time);

                if ($code >= 200 && $code < 300) {
                    if ($json_error) {
                        return new WP_Error('json_error', __('Invalid JSON response from WooCommerce API', $this->text_domain), array('status' => 500));
                    }
                    return new WP_REST_Response($data, $code);
                }

                // Handle error responses
                if ($json_error) {
                    return new WP_Error('api_error', __('WooCommerce API request failed: ', $this->text_domain) . $code . ' - Non-JSON response', array('status' => $code));
                }
                $msg = isset($data['message']) ? $data['message'] : 'Unknown error';
                $code_name = isset($data['code']) ? $data['code'] : 'api_error';
                return new WP_Error($code_name, __('WooCommerce API request failed: ', $this->text_domain) . $msg, array('status' => $code));
            } catch (Exception $e) {
                $this->log_request('/create-order', 'POST', 500, $_SERVER['REMOTE_ADDR'], microtime(true) - $start_time);
                return new WP_Error('order_creation_error', $e->getMessage(), array('status' => 500));
            }
        }

        // Pull store defaults (currency, country/state) from WooCommerce options
        private function get_store_defaults() {
            $default_country = get_option('woocommerce_default_country', 'BD');
            $parts = explode(':', $default_country);
            $country = $parts[0] ?? 'BD';
            $state = $parts[1] ?? '';
            $currency = get_option('woocommerce_currency', 'BDT');
            return array(
                'country' => $country,
                'state' => $state,
                'currency' => $currency,
            );
        }

        /** ========== SHIPPING CALCULATION ========== */
        public function handle_calculate_shipping($request) {
            $start_time = microtime(true);
            try {
                if (!class_exists('WC_Shipping')) {
                    return new WP_Error('woocommerce_missing', 'WooCommerce not loaded', array('status' => 500));
                }

                $payload = $request->get_json_params();
                $line_items = $payload['line_items'] ?? array();
                if (empty($line_items) || !is_array($line_items)) {
                    return new WP_Error('invalid_payload', 'line_items required for shipping calculation', array('status' => 400));
                }

                $defaults = $this->get_store_defaults();
                $shipping = $payload['shipping'] ?? array();
                $destination = array(
                    'country'   => sanitize_text_field($shipping['country'] ?? $defaults['country']),
                    'state'     => sanitize_text_field($shipping['state'] ?? $defaults['state']),
                    'postcode'  => sanitize_text_field($shipping['postcode'] ?? ''),
                    'city'      => sanitize_text_field($shipping['city'] ?? ''),
                    'address'   => sanitize_text_field($shipping['address_1'] ?? ($shipping['address'] ?? '')),
                    'address_2' => sanitize_text_field($shipping['address_2'] ?? ''),
                );

                if (!function_exists('wc_load_cart')) {
                    include_once WC_ABSPATH . 'includes/wc-cart-functions.php';
                    include_once WC_ABSPATH . 'includes/class-wc-cart.php';
                }

                // Build package
                $contents = array();
                $contents_cost = 0;
                foreach ($line_items as $idx => $item) {
                    $pid = absint($item['product_id'] ?? 0);
                    $vid = absint($item['variation_id'] ?? 0);
                    $qty = max(1, absint($item['quantity'] ?? 1));
                    if (!$pid) continue;
                    $product = $vid ? wc_get_product($vid) : wc_get_product($pid);
                    if (!$product) continue;
                    $line_price = floatval($product->get_price()) * $qty;
                    $contents_cost += $line_price;
                    $contents[$idx] = array(
                        'data'     => $product,
                        'quantity' => $qty,
                        'line_total' => $line_price,
                    );
                }

                $packages = array(
                    array(
                        'contents'        => $contents,
                        'contents_cost'   => $contents_cost,
                        'applied_coupons' => array(),
                        'destination'     => $destination,
                    )
                );

                $shipping = new WC_Shipping();
                $shipping->calculate_shipping($packages);
                $results = $shipping->get_packages();
                $first = $results[0]['rates'] ?? array();

                $rates = array();
                foreach ($first as $rate) {
                    $rates[] = array(
                        'id'          => $rate->get_id(),
                        'method_id'   => $rate->get_method_id(),
                        'instance_id' => $rate->get_instance_id(),
                        'label'       => $rate->get_label(),
                        'total'       => wc_format_decimal($rate->get_cost()),
                        'meta_data'   => $rate->get_meta_data(),
                    );
                }

                $selected = null;
                if (!empty($rates)) {
                    // Prefer the first rate returned by WooCommerce
                    $selected = $rates[0]['id'];
                }

                $this->log_request('/calculate-shipping', 'POST', 200, $_SERVER['REMOTE_ADDR'], microtime(true) - $start_time);
                return array(
                    'rates' => $rates,
                    'selected_rate_id' => $selected,
                );
            } catch (Exception $e) {
                $this->log_request('/calculate-shipping', 'POST', 500, $_SERVER['REMOTE_ADDR'], microtime(true) - $start_time);
                return new WP_Error('shipping_calc_error', $e->getMessage(), array('status' => 500));
            }
        }

        public function handle_test_connection($request) {
            $start_time = microtime(true);
            try {
                $ck = $this->get_wc_consumer_key();
                $cs = $this->get_wc_consumer_secret();
                if (!$ck || !$cs) {
                    $this->log_request('/test-connection','GET',500,$_SERVER['REMOTE_ADDR'], microtime(true)-$start_time);
                    return new WP_Error('missing_credentials', __('WooCommerce API credentials not configured', $this->text_domain), array('status' => 500));
                }
                $wc_api_url = $this->build_wc_url('/products');
                $wc_api_url = add_query_arg(array('per_page' => 1), $wc_api_url);
                $args = array(
                    'headers' => array(
                        'Content-Type' => 'application/json',
                        'Accept' => 'application/json',
                        'User-Agent' => 'Headless-Proxy-Manager/1.1.0',
                        'Authorization' => $this->get_basic_auth_header($ck, $cs),
                    ),
                    'timeout' => 30
                );
                $response = wp_remote_get($wc_api_url, $args);
                if (is_wp_error($response)) {
                    $this->log_request('/test-connection','GET',500,$_SERVER['REMOTE_ADDR'], microtime(true)-$start_time);
                    return array('success' => false, 'error' => 'Connection failed: ' . $response->get_error_message(), 'timestamp' => current_time('Y-m-d H:i:s'));
                }
                $code = wp_remote_retrieve_response_code($response);
                $body = wp_remote_retrieve_body($response);
                $this->log_request('/test-connection','GET',$code,$_SERVER['REMOTE_ADDR'], microtime(true)-$start_time);
                if ($code >= 200 && $code < 300) {
                    $data = json_decode($body, true);
                    if (json_last_error() !== JSON_ERROR_NONE) {
                        return array('success' => false, 'error' => 'Invalid JSON response from WooCommerce API', 'response_code' => $code, 'timestamp' => current_time('Y-m-d H:i:s'));
                    }
                    return array('success' => true, 'message' => 'WooCommerce API connection successful', 'products_count' => count($data), 'response_code' => $code, 'timestamp' => current_time('Y-m-d H:i:s'));
                } else {
                    return array('success' => false, 'error' => 'WooCommerce API returned error', 'response_code' => $code, 'response_body' => substr($body, 0, 500), 'timestamp' => current_time('Y-m-d H:i:s'));
                }
            } catch (Exception $e) {
                $this->log_request('/test-connection','GET',500,$_SERVER['REMOTE_ADDR'], microtime(true)-$start_time);
                return array('success' => false, 'error' => 'Test failed: ' . $e->getMessage(), 'timestamp' => current_time('Y-m-d H:i:s'));
            }
        }

        public function handle_sms_callback($request) {
            try {
                $data = $request->get_json_params() ?: $request->get_body_params();
                error_log('SMS Callback received: ' . json_encode($data));
                $msgid = sanitize_text_field($data['msgid'] ?? $data['message_id'] ?? '');
                $to = sanitize_text_field($data['to'] ?? $data['recipient'] ?? '');
                $status = sanitize_text_field($data['status'] ?? '');
                $timestamp = sanitize_text_field($data['timestamp'] ?? current_time('mysql'));
                if (empty($msgid)) {
                    return new WP_Error('missing_message_id', 'Message ID is required', array('status' => 400));
                }
                $this->store_sms_status($msgid, $to, $status, $timestamp);
                error_log("SMS Status Update - ID: {$msgid}, To: {$to}, Status: {$status}");
                return array(
                    'success' => true,
                    'message' => 'SMS status updated successfully',
                    'msgid' => $msgid,
                    'status' => $status
                );
            } catch (Exception $e) {
                error_log('SMS Callback Error: ' . $e->getMessage());
                return new WP_Error('callback_error', 'Failed to process SMS callback: ' . $e->getMessage(), array('status' => 500));
            }
        }

        public function handle_send_sms($request) {
            try {
                $data = $request->get_json_params();
                $to = sanitize_text_field($data['to'] ?? '');
                $message = sanitize_textarea_field($data['message'] ?? '');
                if (empty($to) || empty($message)) {
                    return new WP_Error('missing_data', 'Missing required fields: to, message', array('status' => 400));
                }
                $token = $this->get_sms_api_token();
                if (empty($token)) {
                    return new WP_Error('sms_not_configured', 'SMS API token is not configured', array('status' => 500));
                }
                $options = get_option($this->option_name, array());
                if (empty($options['sms_enabled'])) {
                    return new WP_Error('sms_disabled', 'SMS features are disabled', array('status' => 403));
                }
                $callback_url = rest_url( hpm_get_api_namespace() . '/sms-callback' );
                $form_data = array(
                    'token' => $token,
                    'to' => $to,
                    'message' => $message,
                    'callback_url' => $callback_url
                );
                $args = array(
                    'method' => 'POST',
                    'headers' => array(
                        'Content-Type' => 'application/x-www-form-urlencoded',
                    ),
                    'body' => http_build_query($form_data),
                    'timeout' => 30
                );
                $response = wp_remote_post('https://api.greenweb.com.bd/api.php', $args);
                if (is_wp_error($response)) {
                    return new WP_Error('sms_error', 'Failed to send SMS: ' . $response->get_error_message(), array('status' => 500));
                }
                $body = wp_remote_retrieve_body($response);
                $code = wp_remote_retrieve_response_code($response);
                if ($code >= 200 && $code < 300) {
                    $response_data = json_decode($body, true);
                    $greenweb_msgid = null;
                    if ($response_data && isset($response_data['msgid'])) {
                        $greenweb_msgid = $response_data['msgid'];
                    } elseif (is_string($body) && preg_match('/msgid[:\s]*([^\s]+)/i', $body, $matches)) {
                        $greenweb_msgid = trim($matches[1]);
                    }
                    $our_msgid = 'hpm_sms_' . time() . '_' . substr(md5($to . $message), 0, 8);
                    $this->store_sms_record($our_msgid, $to, $message, 'SENT', $greenweb_msgid);
                    return array(
                        'success' => true,
                        'message' => 'SMS sent successfully',
                        'msgid' => $our_msgid,
                        'greenweb_msgid' => $greenweb_msgid,
                        'response' => $body
                    );
                } else {
                    return new WP_Error('sms_failed', 'SMS sending failed: ' . $body, array('status' => $code));
                }
            } catch (Exception $e) {
                return new WP_Error('send_sms_error', 'Failed to send SMS: ' . $e->getMessage(), array('status' => 500));
            }
        }

        private function store_sms_record($msgid, $to, $message, $status = 'SENT', $greenweb_msgid = null) {
            global $wpdb;
            $table_name = $wpdb->prefix . 'headless_proxy_sms_logs';
            $this->create_sms_logs_table();
            $wpdb->insert(
                $table_name,
                array(
                    'msgid' => $msgid,
                    'greenweb_msgid' => $greenweb_msgid,
                    'recipient' => $to,
                    'message' => $message,
                    'status' => $status,
                    'sent_at' => current_time('mysql'),
                    'created_at' => current_time('mysql')
                ),
                array('%s', '%s', '%s', '%s', '%s', '%s', '%s')
            );
        }

        private function store_sms_status($msgid, $to, $status, $timestamp) {
            global $wpdb;
            $table_name = $wpdb->prefix . 'headless_proxy_sms_logs';
            $this->create_sms_logs_table();
            $existing = $wpdb->get_row($wpdb->prepare(
                "SELECT id FROM {$table_name} WHERE msgid = %s", $msgid
            ));
            if (!$existing) {
                $existing = $wpdb->get_row($wpdb->prepare(
                    "SELECT id FROM {$table_name} WHERE greenweb_msgid = %s", $msgid
                ));
            }
            if ($existing) {
                $wpdb->update(
                    $table_name,
                    array(
                        'status' => $status,
                        'updated_at' => current_time('mysql'),
                        'delivered_at' => ($status === 'DELIVERED') ? $timestamp : null
                    ),
                    array('id' => $existing->id),
                    array('%s', '%s', '%s'),
                    array('%d')
                );
            } else {
                $wpdb->insert(
                    $table_name,
                    array(
                        'msgid' => 'callback_' . $msgid,
                        'greenweb_msgid' => $msgid,
                        'recipient' => $to,
                        'message' => '',
                        'status' => $status,
                        'sent_at' => $timestamp,
                        'created_at' => current_time('mysql'),
                        'updated_at' => current_time('mysql'),
                        'delivered_at' => ($status === 'DELIVERED') ? $timestamp : null
                    ),
                    array('%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s')
                );
            }
        }

        private function create_sms_logs_table() {
            global $wpdb;
            $table_name = $wpdb->prefix . 'headless_proxy_sms_logs';
            $charset_collate = $wpdb->get_charset_collate();
            $sql = "CREATE TABLE IF NOT EXISTS {$table_name} (
                id mediumint(9) NOT NULL AUTO_INCREMENT,
                msgid varchar(255) NOT NULL,
                greenweb_msgid varchar(255) NULL,
                recipient varchar(20) NOT NULL,
                message text,
                status varchar(50) DEFAULT 'SENT',
                sent_at datetime DEFAULT CURRENT_TIMESTAMP,
                delivered_at datetime NULL,
                created_at datetime DEFAULT CURRENT_TIMESTAMP,
                updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY msgid (msgid),
                UNIQUE KEY greenweb_msgid (greenweb_msgid),
                KEY recipient (recipient),
                KEY status (status)
            ) {$charset_collate};";
            require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
            dbDelta($sql);
        }

        private function is_valid_endpoint($endpoint) {
            $endpoint = trim($endpoint, '/');
            if (strpos($endpoint, '..') !== false || strpos($endpoint, '\\') !== false) return false;
            if (!preg_match('/^[a-zA-Z0-9\/\-_]+$/', $endpoint)) return false;
            $options = get_option($this->option_name, array());
            $default = "/products\n/products/categories\n/data/countries\n/settings/general\n/payment_gateways\n/coupons\n/orders\n/customers\n/webhooks\n/reports/sales";
            $allowed = array_map('trim', explode("\n", $options['allowed_endpoints'] ?? $default));
            foreach ($allowed as $a) {
                $a = trim($a, '/');
                if ($a !== '' && strpos($endpoint, $a) === 0) return true;
            }
            return false;
        }

        private function check_rate_limit() {
            $options = get_option($this->option_name, array());
            $rate_limit = $options['rate_limit'] ?? 100;
            $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
            $key = 'hpm_proxy_rate_' . md5($ip);
            $count = (int)(get_transient($key) ?: 0);
            if ($count >= $rate_limit) return false;
            set_transient($key, $count + 1, 60);
            return true;
        }

        private function log_request($endpoint, $method, $status, $ip, $response_time) {
            $options = get_option($this->option_name, array());
            if (empty($options['enable_logging'])) return;
            $logs = get_option('headless_proxy_manager_logs', array());
            $logs[] = array(
                'time' => current_time('Y-m-d H:i:s'),
                'endpoint' => $endpoint,
                'method' => $method,
                'status' => $status,
                'ip' => $ip,
                'response_time' => round($response_time * 1000, 2),
            );
            if (count($logs) > 1000) $logs = array_slice($logs, -1000);
            update_option('headless_proxy_manager_logs', $logs);
        }

        private function get_wc_consumer_key() {
            $options = get_option($this->option_name, array());
            if (!empty($options['wc_consumer_key'])) return $options['wc_consumer_key'];
            if (defined('WC_CONSUMER_KEY')) return WC_CONSUMER_KEY;
            return false;
        }

        private function get_wc_consumer_secret() {
            $options = get_option($this->option_name, array());
            if (!empty($options['wc_consumer_secret'])) return $options['wc_consumer_secret'];
            if (defined('WC_CONSUMER_SECRET')) return WC_CONSUMER_SECRET;
            return false;
        }

        private function get_proxy_secret() {
            $options = get_option($this->option_name, array());
            if (!empty($options['proxy_secret'])) return $options['proxy_secret'];
            return 'change-me-please';
        }

        private function get_sms_api_token() {
            $options = get_option($this->option_name, array());
            if (!empty($options['sms_api_token'])) return $options['sms_api_token'];
            return false;
        }

        private function get_wc_gateway_by_id($gateway_id) {
            if (!class_exists('WC_Payment_Gateways')) return false;
            $gateways = WC()->payment_gateways() ? WC()->payment_gateways()->payment_gateways() : array();
            return $gateways[ $gateway_id ] ?? false;
        }

        private function sanitize_shipping_lines_for_rest($shipping_lines) {
            if (empty($shipping_lines) || !is_array($shipping_lines)) return array();
            $clean = array();
            foreach ($shipping_lines as $line) {
                $method_id = sanitize_text_field($line['method_id'] ?? '');
                $method_title = sanitize_text_field($line['method_title'] ?? 'Shipping');
                $total = isset($line['total']) ? wc_format_decimal($line['total']) : '0';
                if ($method_id === '') {
                    continue; // Woo REST rejects empty method_id
                }
                $clean[] = array(
                    'method_id' => $method_id,
                    'method_title' => $method_title,
                    'total' => $total,
                );
            }
            return $clean;
        }

        private function get_brand_settings() {
            $options = get_option('headless_proxy_brand_settings', array());
            return array(
                'primary_color' => $options['primary_color'] ?? '#0ea5e9',
                'secondary_color' => $options['secondary_color'] ?? '#1f2937',
                'brand_font' => $options['brand_font'] ?? 'Inter, Arial, sans-serif',
            );
        }

        /**
         * Search products by name only using direct database query
         * Case-insensitive and matches partial words anywhere in title
         */
        private function search_products_by_name_only($search_term, $params = array()) {
            if (empty($search_term) || !function_exists('wc_get_products')) {
                return false;
            }
            
            global $wpdb;
            
            $per_page = isset($params['per_page']) ? absint($params['per_page']) : 10;
            $page = isset($params['page']) ? absint($params['page']) : 1;
            $orderby = isset($params['orderby']) ? sanitize_text_field($params['orderby']) : 'title';
            $order = isset($params['order']) ? sanitize_text_field($params['order']) : 'asc';
            
            // Sanitize search term for SQL LIKE query (case-insensitive)
            // Trim and handle special characters properly
            $search_term_clean = trim($search_term);
            // Escape special SQL characters and add wildcards
            $search_escaped = $wpdb->esc_like($search_term_clean);
            $search_like = '%' . $search_escaped . '%';
            
            // Build ORDER BY clause (sanitized)
            $order_direction = strtoupper($order) === 'DESC' ? 'DESC' : 'ASC';
            if ($orderby === 'title') {
                $order_by_field = 'p.post_title';
            } else {
                $order_by_field = 'p.post_date';
            }
            
            // Direct SQL query to find products where title contains search term (case-insensitive)
            // Using LOWER() for case-insensitive matching - this ensures "Edward" matches "Edward" anywhere in title
            $offset = ($page - 1) * $per_page;
            
            // Build query with proper escaping - using COLLATE utf8mb4_general_ci for better case-insensitive matching
            $sql = $wpdb->prepare(
                "SELECT p.ID, p.post_title 
                FROM {$wpdb->posts} p
                WHERE p.post_type = 'product'
                AND p.post_status = 'publish'
                AND LOWER(p.post_title) LIKE LOWER(%s)
                ORDER BY {$order_by_field} {$order_direction}
                LIMIT %d OFFSET %d",
                $search_like,
                $per_page,
                $offset
            );
            
            $matching_posts = $wpdb->get_results($sql);
            
            // Get total count with same query logic
            $count_sql = $wpdb->prepare(
                "SELECT COUNT(*) 
                FROM {$wpdb->posts} p
                WHERE p.post_type = 'product'
                AND p.post_status = 'publish'
                AND LOWER(p.post_title) LIKE LOWER(%s)",
                $search_like
            );
            
            $total_matching = (int) $wpdb->get_var($count_sql);
            
            if (empty($matching_posts)) {
                return array('products' => array(), 'total' => 0);
            }
            
            $products = array();
            foreach ($matching_posts as $post_row) {
                $product = wc_get_product($post_row->ID);
                if (!$product) continue;
                
                // Convert to REST API format (minimal fields)
                $product_data = array(
                    'id' => $product->get_id(),
                    'name' => $product->get_name(),
                    'slug' => $product->get_slug(),
                    'permalink' => $product->get_permalink(),
                    'type' => $product->get_type(),
                    'status' => $product->get_status(),
                    'featured' => $product->get_featured(),
                    'price' => $product->get_price(),
                    'regular_price' => $product->get_regular_price(),
                    'sale_price' => $product->get_sale_price(),
                    'price_html' => $product->get_price_html(),
                    'on_sale' => $product->is_on_sale(),
                    'images' => array(),
                    'categories' => array(),
                    'tags' => array(),
                    'average_rating' => $product->get_average_rating(),
                    'rating_count' => $product->get_rating_count(),
                    'stock_status' => $product->get_stock_status(),
                    'sku' => $product->get_sku(),
                    'meta_data' => array(),
                );
                
                // Get images
                $image_ids = $product->get_gallery_image_ids();
                $image_ids[] = $product->get_image_id();
                foreach ($image_ids as $img_id) {
                    if ($img_id) {
                        $img = wp_get_attachment_image_src($img_id, 'full');
                        if ($img) {
                            $product_data['images'][] = array(
                                'id' => $img_id,
                                'src' => $img[0],
                                'name' => get_the_title($img_id),
                                'alt' => get_post_meta($img_id, '_wp_attachment_image_alt', true),
                            );
                        }
                    }
                }
                
                // Get categories
                $terms = wp_get_post_terms($product->get_id(), 'product_cat');
                foreach ($terms as $term) {
                    $product_data['categories'][] = array(
                        'id' => $term->term_id,
                        'name' => $term->name,
                        'slug' => $term->slug,
                    );
                }
                
                // Get tags
                $tag_terms = wp_get_post_terms($product->get_id(), 'product_tag');
                foreach ($tag_terms as $term) {
                    $product_data['tags'][] = array(
                        'id' => $term->term_id,
                        'name' => $term->name,
                        'slug' => $term->slug,
                    );
                }
                
                // Get meta data (limited to essential)
                $meta_data = $product->get_meta_data();
                foreach ($meta_data as $meta) {
                    $key = $meta->get_data()['key'] ?? '';
                    if (in_array($key, array('_msds_rating_avg', '_msds_rating_count'))) {
                        $product_data['meta_data'][] = array(
                            'id' => $meta->get_id(),
                            'key' => $key,
                            'value' => $meta->get_data()['value'] ?? '',
                        );
                    }
                }
                
                $products[] = $product_data;
            }
            
            return array(
                'products' => $products,
                'total' => $total_matching,
            );
        }

        /**
         * Filter product fields to reduce payload size
         * Only keeps essential fields for list views
         */
        private function filter_product_fields($data, $already_filtered = false) {
            if ($already_filtered) {
                return $data; // WooCommerce already filtered via _fields param
            }
            
            // Essential fields for product cards/list views
            $essential_fields = array(
                'id', 'name', 'slug', 'permalink', 'type', 'status', 'featured',
                'price', 'regular_price', 'sale_price', 'price_html', 'on_sale',
                'images', 'categories', 'tags', 'average_rating', 'rating_count',
                'stock_status', 'sku', 'meta_data'
            );
            
            if (isset($data[0]) && is_array($data[0])) {
                // Array of products
                return array_map(function($product) use ($essential_fields) {
                    return array_intersect_key($product, array_flip($essential_fields));
                }, $data);
            } elseif (is_array($data)) {
                // Single product - keep all fields for detail view
                return $data;
            }
            
            return $data;
        }

        /**
         * Ensure category count field is present and accurate
         * If count is missing or 0, calculate it from published products
         */
        private function ensure_category_counts($data) {
            if (!is_array($data)) {
                return $data;
            }
            
            // If it's a single category object
            if (isset($data['id']) && isset($data['name'])) {
                if (!isset($data['count']) || $data['count'] === 0) {
                    $data['count'] = $this->get_category_product_count($data['id']);
                }
                return $data;
            }
            
            // If it's an array of categories
            foreach ($data as &$category) {
                if (is_array($category) && isset($category['id'])) {
                    // Ensure count is always a number
                    if (!isset($category['count']) || $category['count'] === null) {
                        $category['count'] = $this->get_category_product_count($category['id']);
                    } else {
                        // Ensure count is an integer
                        $category['count'] = (int) $category['count'];
                    }
                }
            }
            unset($category); // Break reference
            
            return $data;
        }

        /**
         * Get the count of published products in a category
         */
        private function get_category_product_count($category_id) {
            global $wpdb;
            
            if (empty($category_id)) {
                return 0;
            }
            
            // Get count of published products in this category
            $count = $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(DISTINCT p.ID) 
                FROM {$wpdb->posts} p
                INNER JOIN {$wpdb->term_relationships} tr ON p.ID = tr.object_id
                INNER JOIN {$wpdb->term_taxonomy} tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
                WHERE p.post_type = 'product'
                AND p.post_status = 'publish'
                AND tt.taxonomy = 'product_cat'
                AND tt.term_id = %d",
                $category_id
            ));
            
            return (int) ($count ?: 0);
        }

        private function validate_order_data($order_data) {
            $errors = array();
            if (empty($order_data['payment_method'])) $errors[] = 'Payment method is required';
            if (empty($order_data['billing']) || !is_array($order_data['billing'])) {
                $errors[] = 'Billing information is required';
            } else {
                if (empty($order_data['billing']['first_name'])) $errors[] = 'Billing first name is required';
                if (empty($order_data['billing']['email'])) $errors[] = 'Billing email is required';
            }
            if (empty($order_data['shipping']) || !is_array($order_data['shipping'])) $errors[] = 'Shipping information is required';
            if (empty($order_data['line_items']) || !is_array($order_data['line_items'])) {
                $errors[] = 'Line items are required';
            } else {
                foreach ($order_data['line_items'] as $i => $item) {
                    if (empty($item['product_id']) || !is_numeric($item['product_id'])) $errors[] = "Line item " . ($i + 1) . ": Invalid product_id";
                    if (!isset($item['quantity']) || !is_numeric($item['quantity']) || $item['quantity'] <= 0) $errors[] = "Line item " . ($i + 1) . ": Invalid quantity";
                }
            }
            return $errors;
        }

        private function prepare_order_data($order_data) {
            $prepared = array(
                'payment_method' => sanitize_text_field($order_data['payment_method'] ?? 'cod'),
                'payment_method_title' => sanitize_text_field($order_data['payment_method_title'] ?? 'Cash on delivery'),
                'set_paid' => !empty($order_data['set_paid']) ? (bool)$order_data['set_paid'] : false,
            );
            if (!empty($order_data['billing']) && is_array($order_data['billing'])) {
                $prepared['billing'] = array(
                    'first_name' => sanitize_text_field($order_data['billing']['first_name'] ?? ''),
                    'last_name' => sanitize_text_field($order_data['billing']['last_name'] ?? ''),
                    'email' => sanitize_email($order_data['billing']['email'] ?? ''),
                    'phone' => sanitize_text_field($order_data['billing']['phone'] ?? ''),
                    'address_1' => sanitize_text_field($order_data['billing']['address_1'] ?? ''),
                    'address_2' => sanitize_text_field($order_data['billing']['address_2'] ?? ''),
                    'city' => sanitize_text_field($order_data['billing']['city'] ?? ''),
                    'state' => sanitize_text_field($order_data['billing']['state'] ?? ''),
                    'postcode' => sanitize_text_field($order_data['billing']['postcode'] ?? ''),
                    'country' => sanitize_text_field($order_data['billing']['country'] ?? 'BD'),
                );
            }
            if (!empty($order_data['shipping']) && is_array($order_data['shipping'])) {
                $prepared['shipping'] = array(
                    'first_name' => sanitize_text_field($order_data['shipping']['first_name'] ?? ''),
                    'last_name' => sanitize_text_field($order_data['shipping']['last_name'] ?? ''),
                    'address_1' => sanitize_text_field($order_data['shipping']['address_1'] ?? ''),
                    'address_2' => sanitize_text_field($order_data['shipping']['address_2'] ?? ''),
                    'city' => sanitize_text_field($order_data['shipping']['city'] ?? ''),
                    'state' => sanitize_text_field($order_data['shipping']['state'] ?? ''),
                    'postcode' => sanitize_text_field($order_data['shipping']['postcode'] ?? ''),
                    'country' => sanitize_text_field($order_data['shipping']['country'] ?? 'BD'),
                    'phone' => sanitize_text_field($order_data['shipping']['phone'] ?? ''),
                );
            }
            if (!empty($order_data['line_items']) && is_array($order_data['line_items'])) {
                $prepared['line_items'] = array();
                foreach ($order_data['line_items'] as $item) {
                    $li = array(
                        'product_id' => absint($item['product_id']),
                        'quantity' => absint($item['quantity']),
                    );
                    if (!empty($item['variation_id'])) $li['variation_id'] = absint($item['variation_id']);
                    if (!empty($item['meta_data']) && is_array($item['meta_data'])) {
                        $li['meta_data'] = array();
                        foreach ($item['meta_data'] as $meta) {
                            $li['meta_data'][] = array(
                                'key' => sanitize_text_field($meta['key'] ?? ''),
                                'value' => is_array($meta['value']) ? $meta['value'] : sanitize_text_field($meta['value'] ?? ''),
                            );
                        }
                    }
                    $prepared['line_items'][] = $li;
                }
            }
            if (!empty($order_data['shipping_lines']) && is_array($order_data['shipping_lines'])) {
                $prepared['shipping_lines'] = array();
                foreach ($order_data['shipping_lines'] as $shipping) {
                    $prepared['shipping_lines'][] = array(
                        'method_id' => sanitize_text_field($shipping['method_id'] ?? 'flat_rate'),
                        'method_title' => sanitize_text_field($shipping['method_title'] ?? 'Flat Rate'),
                        'total' => sanitize_text_field($shipping['total'] ?? '0.00'),
                    );
                }
            }
            if (!empty($order_data['coupon_lines']) && is_array($order_data['coupon_lines'])) {
                $prepared['coupon_lines'] = array();
                foreach ($order_data['coupon_lines'] as $coupon) {
                    $prepared['coupon_lines'][] = array('code' => sanitize_text_field($coupon['code'] ?? ''));
                }
            }
            if (!empty($order_data['meta_data']) && is_array($order_data['meta_data'])) {
                $prepared['meta_data'] = array();
                foreach ($order_data['meta_data'] as $meta) {
                    $prepared['meta_data'][] = array(
                        'key' => sanitize_text_field($meta['key'] ?? ''),
                        'value' => is_array($meta['value']) ? $meta['value'] : sanitize_text_field($meta['value'] ?? ''),
                    );
                }
            }
            return $prepared;
        }
    }

    /**
     * Product FAQs: adds repeatable FAQ fields to products and exposes them via REST.
     */
    class HPM_Product_FAQs {
        const META_KEY = 'hpm_product_faqs';
        private $text_domain = 'headless-proxy-manager';

        public function __construct() {
            add_action('add_meta_boxes', array($this, 'add_metabox'));
            add_action('save_post_product', array($this, 'save_faqs'));
            add_action('rest_api_init', array($this, 'register_rest_routes'));
            add_filter('woocommerce_product_tabs', array($this, 'add_wc_product_tab'));
        }

        public function add_metabox() {
            add_meta_box(
                'hpm_product_faqs',
                __('Product FAQs', $this->text_domain),
                array($this, 'render_metabox'),
                'product',
                'normal',
                'default'
            );
        }

        public function render_metabox($post) {
            wp_nonce_field('hpm_save_faqs', 'hpm_faqs_nonce');

            $faqs = get_post_meta($post->ID, self::META_KEY, true);
            if (!is_array($faqs)) {
                $faqs = array();
            }
            ?>
            <style>
                .hpm-faq-row { border: 1px solid #e2e8f0; padding: 12px; margin-bottom: 10px; background: #fff; border-radius: 6px; }
                .hpm-faq-row .hpm-row-actions { text-align: right; margin-top: 6px; }
                .hpm-faq-row .hpm-row-actions .button-link-delete { color: #b91c1c; }
                .hpm-faqs-wrap .hpm-empty { color: #64748b; font-style: italic; margin-bottom: 8px; }
                .hpm-faqs-toolbar { margin: 8px 0 0; }
                .hpm-faq-row label { display:block; font-weight:600; margin: 6px 0 4px; }
                .hpm-faq-row input[type="text"] { width:100%; }
                .hpm-faq-row textarea { width:100%; min-height: 80px; }
            </style>

            <div class="hpm-faqs-wrap">
                <p class="description"><?php _e('Add frequently asked questions for this product. These will be available via REST API.', $this->text_domain); ?></p>
                <div id="hpm-faqs-list">
                    <?php if (empty($faqs)) : ?>
                        <p class="hpm-empty"><?php _e('No FAQs yet. Click "Add FAQ" to create one.', $this->text_domain); ?></p>
                    <?php else: ?>
                        <?php foreach ($faqs as $faq):
                            $question = isset($faq['question']) ? esc_attr($faq['question']) : '';
                            $answer   = isset($faq['answer']) ? esc_textarea($faq['answer']) : '';
                        ?>
                        <div class="hpm-faq-row">
                            <label><?php _e('Question', $this->text_domain); ?></label>
                            <input type="text" name="hpm_faq_question[]" value="<?php echo $question; ?>" placeholder="<?php esc_attr_e('Enter question', $this->text_domain); ?>" />

                            <label><?php _e('Answer', $this->text_domain); ?></label>
                            <textarea name="hpm_faq_answer[]" placeholder="<?php esc_attr_e('Enter answer (HTML allowed)', $this->text_domain); ?>"><?php echo $answer; ?></textarea>

                            <div class="hpm-row-actions">
                                <a href="#" class="button-link-delete hpm-remove-faq"><?php _e('Remove', $this->text_domain); ?></a>
                            </div>
                        </div>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </div>

                <div class="hpm-faqs-toolbar">
                    <button type="button" class="button button-secondary" id="hpm-add-faq"><?php _e('Add FAQ', $this->text_domain); ?></button>
                </div>
            </div>

            <template id="hpm-faq-row-template">
                <div class="hpm-faq-row">
                    <label><?php _e('Question', $this->text_domain); ?></label>
                    <input type="text" name="hpm_faq_question[]" value="" placeholder="<?php esc_attr_e('Enter question', $this->text_domain); ?>" />

                    <label><?php _e('Answer', $this->text_domain); ?></label>
                    <textarea name="hpm_faq_answer[]" placeholder="<?php esc_attr_e('Enter answer (HTML allowed)', $this->text_domain); ?>"></textarea>

                    <div class="hpm-row-actions">
                        <a href="#" class="button-link-delete hpm-remove-faq"><?php _e('Remove', $this->text_domain); ?></a>
                    </div>
                </div>
            </template>

            <script>
                (function() {
                    const list = document.getElementById('hpm-faqs-list');
                    const btnAdd = document.getElementById('hpm-add-faq');
                    const tpl = document.getElementById('hpm-faq-row-template');

                    function ensureEmptyHint() {
                        const empty = list.querySelector('.hpm-empty');
                        if (list.querySelector('.hpm-faq-row')) {
                            if (empty) empty.remove();
                        } else if (!empty) {
                            const p = document.createElement('p');
                            p.className = 'hpm-empty';
                            p.textContent = '<?php echo esc_js(__('No FAQs yet. Click "Add FAQ" to create one.', $this->text_domain)); ?>';
                            list.appendChild(p);
                        }
                    }

                    if (btnAdd) {
                        btnAdd.addEventListener('click', function() {
                            const node = document.importNode(tpl.content, true);
                            list.appendChild(node);
                            ensureEmptyHint();
                        });
                    }

                    list.addEventListener('click', function(e) {
                        const target = e.target;
                        if (target && target.classList.contains('hpm-remove-faq')) {
                            e.preventDefault();
                            const row = target.closest('.hpm-faq-row');
                            if (row) row.remove();
                            ensureEmptyHint();
                        }
                    });

                    ensureEmptyHint();
                })();
            </script>
            <?php
        }

        public function save_faqs($post_id) {
            if (!isset($_POST['hpm_faqs_nonce']) || !wp_verify_nonce($_POST['hpm_faqs_nonce'], 'hpm_save_faqs')) {
                return;
            }
            if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
                return;
            }
            if (!current_user_can('edit_product', $post_id)) {
                return;
            }

            $qs = isset($_POST['hpm_faq_question']) && is_array($_POST['hpm_faq_question']) ? $_POST['hpm_faq_question'] : array();
            $as = isset($_POST['hpm_faq_answer']) && is_array($_POST['hpm_faq_answer']) ? $_POST['hpm_faq_answer'] : array();

            $faqs = array();
            $count = max(count($qs), count($as));
            for ($i = 0; $i < $count; $i++) {
                $q = isset($qs[$i]) ? trim(wp_unslash($qs[$i])) : '';
                $a = isset($as[$i]) ? trim(wp_unslash($as[$i])) : '';
                if ($q === '' && $a === '') {
                    continue;
                }
                $faqs[] = array(
                    'question' => sanitize_text_field($q),
                    'answer'   => wp_kses_post($a),
                );
            }

            if (!empty($faqs)) {
                update_post_meta($post_id, self::META_KEY, $faqs);
            } else {
                delete_post_meta($post_id, self::META_KEY);
            }
        }

        public function register_rest_routes() {
            register_rest_route(hpm_get_api_namespace(), '/faqs', array(
                'methods'             => 'GET',
                'callback'            => array($this, 'rest_get_faqs'),
                'permission_callback' => '__return_true',
                'args'                => array(
                    'product_id' => array(
                        'required'          => true,
                        'type'              => 'integer',
                        'validate_callback' => function($param) {
                            return intval($param) > 0;
                        },
                    ),
                ),
            ));
        }

        public function rest_get_faqs($request) {
            $product_id = intval($request->get_param('product_id'));
            if ($product_id <= 0) {
                return new WP_REST_Response(array('success' => false, 'error' => 'Invalid product_id'), 400);
            }

            $post = get_post($product_id);
            if (!$post || $post->post_type !== 'product') {
                return new WP_REST_Response(array('success' => false, 'error' => 'Product not found'), 404);
            }

            $faqs = get_post_meta($product_id, self::META_KEY, true);
            if (!is_array($faqs)) {
                $faqs = array();
            }

            $faqs = array_values(array_map(function($row) {
                return array(
                    'question' => isset($row['question']) ? wp_kses_post($row['question']) : '',
                    'answer'   => isset($row['answer']) ? wp_kses_post($row['answer']) : '',
                );
            }, $faqs));

            return new WP_REST_Response(array(
                'success'    => true,
                'product_id' => $product_id,
                'faqs'       => $faqs,
            ), 200);
        }

        public function add_wc_product_tab($tabs) {
            $tabs['hpm_faqs'] = array(
                'title'    => __('FAQs', $this->text_domain),
                'priority' => 55,
                'callback' => function() {
                    global $product;
                    if (!$product) {
                        return;
                    }
                    $faqs = get_post_meta($product->get_id(), self::META_KEY, true);
                    if (!is_array($faqs) || empty($faqs)) {
                        echo '<p>' . esc_html__('No FAQs yet.', $this->text_domain) . '</p>';
                        return;
                    }
                    echo '<div class="hpm-faqs-tab">';
                    foreach ($faqs as $faq) {
                        $q = isset($faq['question']) ? wp_kses_post($faq['question']) : '';
                        $a = isset($faq['answer']) ? wp_kses_post($faq['answer']) : '';
                        if ($q === '' && $a === '') {
                            continue;
                        }
                        echo '<div class="hpm-faq-item" style="margin-bottom:12px;">';
                        if ($q) {
                            echo '<strong>' . $q . '</strong>';
                        }
                        if ($a) {
                            echo '<div>' . $a . '</div>';
                        }
                        echo '</div>';
                    }
                    echo '</div>';
                },
            );
            return $tabs;
        }
    }

    /**
     * Custom product labels stored per product and exposed via REST.
     */
    class HPM_Custom_Labels {
        const META_KEY = 'hpm_custom_labels';
        private $text_domain = 'headless-proxy-manager';

        public function __construct() {
            add_action('add_meta_boxes', array($this, 'add_meta_box'));
            add_action('save_post_product', array($this, 'save_meta'));
            add_action('rest_api_init', array($this, 'register_rest_routes'));
        }

        public function add_meta_box() {
            add_meta_box(
                'hpm_custom_labels',
                __('Custom Labels', $this->text_domain),
                array($this, 'render_meta_box'),
                'product',
                'side',
                'default'
            );
        }

        public function render_meta_box($post) {
            wp_nonce_field('hpm_custom_labels_nonce', 'hpm_custom_labels_nonce');
            $labels = get_post_meta($post->ID, self::META_KEY, true);
            $labels_text = is_array($labels) ? implode(' | ', $labels) : '';
            ?>
            <div id="hpm-custom-labels-meta-box">
                <p style="margin-top: 0; margin-bottom: 8px; font-size: 12px; color: #666;">
                    <?php _e('Enter custom labels separated by " | ". These will appear beside the stock status on the product page.', $this->text_domain); ?>
                </p>
                <textarea
                    id="hpm_custom_labels"
                    name="hpm_custom_labels"
                    rows="3"
                    style="width: 100%; resize: vertical; font-family: monospace; font-size: 12px;"
                    placeholder="Free Shipping | Gift | Express Delivery"
                ><?php echo esc_textarea($labels_text); ?></textarea>
                <p style="margin-top: 4px; font-size: 11px; color: #888;">
                    <?php _e('Example: Free Shipping | Gift | Express Delivery', $this->text_domain); ?>
                </p>
            </div>
            <?php
        }

        public function save_meta($post_id) {
            if (!isset($_POST['hpm_custom_labels_nonce']) || !wp_verify_nonce($_POST['hpm_custom_labels_nonce'], 'hpm_custom_labels_nonce')) {
                return;
            }
            if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
                return;
            }
            if (!current_user_can('edit_product', $post_id)) {
                return;
            }

            if (isset($_POST['hpm_custom_labels'])) {
                $labels_text = sanitize_textarea_field(wp_unslash($_POST['hpm_custom_labels']));
                if ($labels_text !== '') {
                    $labels = array_map('trim', explode('|', $labels_text));
                    $labels = array_filter($labels, function($label) {
                        return $label !== '';
                    });
                    if (!empty($labels)) {
                        update_post_meta($post_id, self::META_KEY, array_values($labels));
                        return;
                    }
                }
                delete_post_meta($post_id, self::META_KEY);
            }
        }

        public function register_rest_routes() {
            register_rest_route(hpm_get_api_namespace(), '/custom-labels', array(
                'methods'             => 'GET',
                'callback'            => array($this, 'rest_get_labels'),
                'permission_callback' => '__return_true',
                'args' => array(
                    'product_id' => array(
                        'required'          => true,
                        'type'              => 'integer',
                        'validate_callback' => function($param) {
                            return intval($param) > 0;
                        }
                    ),
                ),
            ));
        }

        public function rest_get_labels($request) {
            $product_id = intval($request->get_param('product_id'));
            if ($product_id <= 0 || get_post_type($product_id) !== 'product') {
                return new WP_REST_Response(array('success' => false, 'error' => 'Invalid product ID'), 400);
            }
            $labels = get_post_meta($product_id, self::META_KEY, true);
            if (!is_array($labels)) {
                $labels = array();
            }
            return new WP_REST_Response(array(
                'success'    => true,
                'product_id' => $product_id,
                'labels'     => array_values($labels),
            ), 200);
        }
    }

    /**
     * Variation extras: layout order, recommendation, description title, richer descriptions, REST exposure, and optional free shipping for a specific product.
     */
    class HPM_Variation_Extras {
        private $text_domain = 'headless-proxy-manager';
        private $free_shipping_product_id = 142;

        public function __construct() {
            add_action('woocommerce_product_after_variable_attributes', array($this, 'render_variation_fields'), 10, 3);
            add_action('woocommerce_save_product_variation', array($this, 'save_variation_meta'), 10, 2);
            add_filter('woocommerce_available_variation', array($this, 'inject_variation_meta'), 10, 3);
            add_filter('woocommerce_rest_product_variation_schema', array($this, 'rest_add_fields_schema'));
            add_filter('woocommerce_rest_prepare_product_variation', array($this, 'rest_add_fields_response'), 10, 3);
            add_action('woocommerce_rest_insert_product_variation', array($this, 'rest_save_fields'), 10, 3);
            add_action('init', array($this, 'register_meta_visibility'));
            add_filter('woocommerce_get_variation_description', array($this, 'format_variation_description'), 10, 2);
            add_filter('woocommerce_package_rates', array($this, 'maybe_free_shipping_product'), 10, 2);
        }

        public function render_variation_fields($loop, $variation_data, $variation) {
            // Layout order
            woocommerce_wp_text_input(array(
                'id'                => "hpm_layout_order_{$loop}",
                'name'              => "hpm_layout_order[{$loop}]",
                'value'             => get_post_meta($variation->ID, 'layout_order', true),
                'label'             => __('Layout Order', $this->text_domain),
                'type'              => 'number',
                'wrapper_class'     => 'form-row form-row-first',
                'desc_tip'          => true,
                'description'       => __('Controls display order for this variation (integer).', $this->text_domain),
                'custom_attributes' => array(
                    'step' => '1',
                    'min'  => '0',
                    'inputmode' => 'numeric',
                ),
            ));

            // Recommendation
            woocommerce_wp_text_input(array(
                'id'            => "hpm_recommendation_{$loop}",
                'name'          => "hpm_recommendation[{$loop}]",
                'value'         => get_post_meta($variation->ID, 'recommendation', true),
                'label'         => __('Recommendation', $this->text_domain),
                'type'          => 'text',
                'wrapper_class' => 'form-row form-row-last',
                'desc_tip'      => true,
                'description'   => __('Short recommendation/note for this variation.', $this->text_domain),
            ));

            // Description title
            woocommerce_wp_text_input(array(
                'id'            => "hpm_description_title_{$loop}",
                'name'          => "hpm_description_title[{$loop}]",
                'value'         => get_post_meta($variation->ID, 'description_title', true),
                'label'         => __('Description Title', $this->text_domain),
                'type'          => 'text',
                'wrapper_class' => 'form-row form-row-wide',
                'desc_tip'      => true,
                'description'   => __('Title for the variation description area.', $this->text_domain),
            ));
        }

        public function save_variation_meta($variation_id, $index) {
            if (isset($_POST['hpm_layout_order'][$index])) {
                update_post_meta($variation_id, 'layout_order', intval($_POST['hpm_layout_order'][$index]));
            }
            if (isset($_POST['hpm_recommendation'][$index])) {
                update_post_meta($variation_id, 'recommendation', sanitize_text_field($_POST['hpm_recommendation'][$index]));
            }
            if (isset($_POST['hpm_description_title'][$index])) {
                update_post_meta($variation_id, 'description_title', sanitize_text_field($_POST['hpm_description_title'][$index]));
            }
        }

        public function inject_variation_meta($data, $product, $variation) {
            $layout_order = (int) get_post_meta($variation->get_id(), 'layout_order', true);
            $recommendation = (string) get_post_meta($variation->get_id(), 'recommendation', true);
            $description_title = (string) get_post_meta($variation->get_id(), 'description_title', true);

            $data['layout_order'] = $layout_order;
            $data['recommendation'] = $recommendation;
            $data['description_title'] = $description_title;

            // Ensure meta_data contains the fields for headless clients reading meta_data
            $data['meta_data'][] = array('key' => 'layout_order', 'value' => $layout_order);
            $data['meta_data'][] = array('key' => 'recommendation', 'value' => $recommendation);
            $data['meta_data'][] = array('key' => 'description_title', 'value' => $description_title);

            // Replace variation description with formatted/allowed HTML + shortcodes
            $data['variation_description'] = $this->format_description_for_output($variation);

            return $data;
        }

        public function rest_add_fields_schema($schema) {
            $schema['properties']['layout_order'] = array(
                'description' => __('Layout order number for this variation.', $this->text_domain),
                'type'        => 'integer',
                'context'     => array('view', 'edit'),
            );
            $schema['properties']['recommendation'] = array(
                'description' => __('Recommendation text for this variation.', $this->text_domain),
                'type'        => 'string',
                'context'     => array('view', 'edit'),
            );
            $schema['properties']['description_title'] = array(
                'description' => __('Description title for this variation.', $this->text_domain),
                'type'        => 'string',
                'context'     => array('view', 'edit'),
            );
            return $schema;
        }

        public function rest_add_fields_response($response, $object, $request) {
            $response->data['layout_order'] = (int) get_post_meta($object->get_id(), 'layout_order', true);
            $response->data['recommendation'] = (string) get_post_meta($object->get_id(), 'recommendation', true);
            $response->data['description_title'] = (string) get_post_meta($object->get_id(), 'description_title', true);
            return $response;
        }

        public function rest_save_fields($object, $request, $creating) {
            $variation_id = $object->get_id();
            if (isset($request['layout_order'])) {
                update_post_meta($variation_id, 'layout_order', intval($request['layout_order']));
            }
            if (isset($request['recommendation'])) {
                update_post_meta($variation_id, 'recommendation', sanitize_text_field($request['recommendation']));
            }
            if (isset($request['description_title'])) {
                update_post_meta($variation_id, 'description_title', sanitize_text_field($request['description_title']));
            }
        }

        public function register_meta_visibility() {
            register_post_meta('product_variation', 'layout_order', array(
                'type'         => 'integer',
                'single'       => true,
                'show_in_rest' => true,
            ));
            register_post_meta('product_variation', 'recommendation', array(
                'type'         => 'string',
                'single'       => true,
                'show_in_rest' => true,
            ));
            register_post_meta('product_variation', 'description_title', array(
                'type'         => 'string',
                'single'       => true,
                'show_in_rest' => true,
            ));
        }

        public function format_variation_description($desc, $variation) {
            return $this->sanitize_variation_html($desc);
        }

        private function format_description_for_output($variation) {
            if (method_exists($variation, 'get_description')) {
                $raw = $variation->get_description('edit');
            } else {
                $raw = '';
            }
            return $this->sanitize_variation_html($raw);
        }

        private function sanitize_variation_html($html) {
            if (empty($html)) {
                return $html;
            }
            $allowed = wp_kses_allowed_html('post');
            $allowed['a']['target'] = true;
            if (!isset($allowed['span'])) {
                $allowed['span'] = array();
            }
            $allowed['span']['class'] = true;
            $allowed['span']['style'] = true;

            $processed = wpautop(wp_kses(do_shortcode($html), $allowed));
            return $processed;
        }

        public function maybe_free_shipping_product($rates, $package) {
            if (is_admin() && !defined('DOING_AJAX')) {
                return $rates;
            }
            $found = false;
            if (WC()->cart) {
                foreach (WC()->cart->get_cart() as $cart_item) {
                    $product_id = isset($cart_item['product_id']) ? $cart_item['product_id'] : 0;
                    $variation_id = isset($cart_item['variation_id']) ? $cart_item['variation_id'] : 0;
                    if ($product_id == $this->free_shipping_product_id || $variation_id == $this->free_shipping_product_id) {
                        $found = true;
                        break;
                    }
                }
            }
            if (!$found) {
                return $rates;
            }
            foreach ($rates as $rate_id => $rate) {
                $rates[$rate_id]->cost = 0;
                if (isset($rates[$rate_id]->taxes) && is_array($rates[$rate_id]->taxes)) {
                    foreach ($rates[$rate_id]->taxes as $tax_id => $tax_amount) {
                        $rates[$rate_id]->taxes[$tax_id] = 0;
                    }
                }
            }
            return $rates;
        }
    }

    // ==============================================
    // Layout Manager Features (Added in separate section for management)
    // This section contains all the code from the original "Kitchen Hero Product Layout Manager",
    // renamed to fit the main plugin (e.g., prefixes changed from 'kh' to 'hpm_lm', class renamed, text domain unified,
    // REST namespace integrated into main namespace, mentions of "Kitchen Hero" removed).
    // You can extract this to a separate file in the 'layout-manager' folder if desired.
    // ==============================================

    define('HPM_LM_VERSION', '1.0.0');

    class HPM_Layout_Manager {
        private $text_domain = 'headless-proxy-manager';

        public function __construct() {
            $this->init_hooks();
        }

        private function init_hooks() {
            add_action('init', array($this, 'init'));
            add_action('admin_init', array($this, 'admin_init'));
            add_action('admin_menu', array($this, 'admin_menu'));
            add_action('add_meta_boxes', array($this, 'add_meta_boxes'));
            add_action('save_post', array($this, 'save_product_meta'));
            add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
            add_action('admin_enqueue_scripts', array($this, 'admin_enqueue_scripts'));
            // Category/Tag meta
            add_action('product_cat_add_form_fields', array($this, 'add_category_fields'));
            add_action('product_cat_edit_form_fields', array($this, 'edit_category_fields'));
            add_action('edited_product_cat', array($this, 'save_category_fields'));
            add_action('created_product_cat', array($this, 'save_category_fields'));
            add_action('product_tag_add_form_fields', array($this, 'add_tag_fields'));
            add_action('product_tag_edit_form_fields', array($this, 'edit_tag_fields'));
            add_action('edited_product_tag', array($this, 'save_tag_fields'));
            add_action('created_product_tag', array($this, 'save_tag_fields'));
            // REST API
            add_action('rest_api_init', array($this, 'register_rest_fields'));
            add_action('rest_api_init', array($this, 'register_layout_settings_endpoint'));
        }

        public function init() {
            load_plugin_textdomain($this->text_domain, false, dirname(plugin_basename(__FILE__)) . '/languages/');
        }

        public function admin_init() {
            register_setting('hpm_lm_layout_settings', 'hpm_lm_layout_default_settings');
        }

        public function admin_menu() {
            add_submenu_page(
                'headless-proxy-manager',
                __('Layout Manager', $this->text_domain),
                __('Layout Manager', $this->text_domain),
                'manage_options',
                'headless-proxy-manager-layout',
                array($this, 'settings_page')
            );
        }

        public function settings_page() {
            ?>
            <div class="wrap">
                <h1><?php _e('Product Layout Manager', $this->text_domain); ?></h1>
                <div class="hpm-lm-layout-tabs">
                    <div class="nav-tab-wrapper">
                        <a href="#general" class="nav-tab nav-tab-active"><?php _e('General Settings', $this->text_domain); ?></a>
                        <a href="#categories" class="nav-tab"><?php _e('Category Settings', $this->text_domain); ?></a>
                        <a href="#tags" class="nav-tab"><?php _e('Tag Settings', $this->text_domain); ?></a>
                    </div>
                    <div id="general" class="tab-content">
                        <form method="post" action="options.php">
                            <?php settings_fields('hpm_lm_layout_settings'); ?>
                            <?php $options = get_option('hpm_lm_layout_default_settings', array()); ?>
                            <table class="form-table">
                                <tr>
                                    <th scope="row"><?php _e('Default Layout', $this->text_domain); ?></th>
                                    <td>
                                        <select name="hpm_lm_layout_default_settings[default_layout]">
                                            <option value="normal" <?php selected($options['default_layout'] ?? 'normal', 'normal'); ?>><?php _e('Normal Layout', $this->text_domain); ?></option>
                                            <option value="collection" <?php selected($options['default_layout'] ?? 'normal', 'collection'); ?>><?php _e('Collection Layout', $this->text_domain); ?></option>
                                            <option value="box" <?php selected($options['default_layout'] ?? 'normal', 'box'); ?>><?php _e('Box Layout', $this->text_domain); ?></option>
                                        </select>
                                    </td>
                                </tr>
                                <tr>
                                    <th scope="row"><?php _e('Default Mobile Width %', $this->text_domain); ?></th>
                                    <td>
                                        <input type="number" name="hpm_lm_layout_default_settings[mobile_width]" value="<?php echo esc_attr($options['mobile_width'] ?? 100); ?>" min="10" max="100" />
                                    </td>
                                </tr>
                                <tr>
                                    <th scope="row"><?php _e('Default Desktop Width %', $this->text_domain); ?></th>
                                    <td>
                                        <input type="number" name="hpm_lm_layout_default_settings[desktop_width]" value="<?php echo esc_attr($options['desktop_width'] ?? 100); ?>" min="10" max="100" />
                                    </td>
                                </tr>
                            </table>
                            <?php submit_button(); ?>
                        </form>
                    </div>
                    <div id="categories" class="tab-content" style="display: none;">
                        <?php $this->render_taxonomy_settings('product_cat'); ?>
                    </div>
                    <div id="tags" class="tab-content" style="display: none;">
                        <?php $this->render_taxonomy_settings('product_tag'); ?>
                    </div>
                </div>
            </div>
            <script>
                jQuery(document).ready(function($) {
                    $('.nav-tab').click(function(e) {
                        e.preventDefault();
                        $('.nav-tab').removeClass('nav-tab-active');
                        $(this).addClass('nav-tab-active');
                        $('.tab-content').hide();
                        $($(this).attr('href')).show();
                    });
                });
            </script>
            <style>
                .hpm-lm-layout-tabs { margin-top: 20px; }
                .hpm-lm-layout-tabs .nav-tab-wrapper { margin-bottom: 20px; }
                .hpm-lm-layout-tabs .tab-content { background: #fff; border: 1px solid #ccd0d4; border-top: none; padding: 20px; }
                .hpm-lm-layout-tabs .tab-content h3 { margin-top: 0; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid #eee; }
                .hpm-lm-layout-tabs .form-table th { width: 200px; }
                .hpm-lm-layout-tabs .wp-list-table { margin-top: 20px; }
                .hpm-lm-layout-tabs .wp-list-table th, .hpm-lm-layout-tabs .wp-list-table td { padding: 12px; vertical-align: middle; }
                .hpm-lm-layout-tabs .wp-list-table .layout-select, .hpm-lm-layout-tabs .wp-list-table .mobile-width, .hpm-lm-layout-tabs .wp-list-table .desktop-width { width: 100px; }
                .hpm-lm-layout-tabs .save-term-settings { min-width: 60px; }
                .hpm-lm-layout-tabs .save-term-settings:disabled { opacity: 0.6; cursor: not-allowed; }
                @media screen and (max-width: 782px) {
                    .hpm-lm-layout-tabs .wp-list-table th, .hpm-lm-layout-tabs .wp-list-table td { padding: 8px 4px; }
                    .hpm-lm-layout-tabs .wp-list-table .layout-select, .hpm-lm-layout-tabs .wp-list-table .mobile-width, .hpm-lm-layout-tabs .wp-list-table .desktop-width { width: 80px; font-size: 12px; }
                    .hpm-lm-layout-tabs .save-term-settings { padding: 4px 8px; font-size: 12px; }
                }
            </style>
            <?php
        }

        private function render_taxonomy_settings($taxonomy) {
            $terms = get_terms(array(
                'taxonomy' => $taxonomy,
                'hide_empty' => false,
            ));
            if (empty($terms)) {
                echo '<p>' . __('No terms found.', $this->text_domain) . '</p>';
                return;
            }
            echo '<table class="wp-list-table widefat fixed striped">';
            echo '<thead><tr><th>' . __('Term', $this->text_domain) . '</th><th>' . __('Layout', $this->text_domain) . '</th><th>' . __('Mobile %', $this->text_domain) . '</th><th>' . __('Desktop %', $this->text_domain) . '</th><th>' . __('Actions', $this->text_domain) . '</th></tr></thead>';
            echo '<tbody>';
            foreach ($terms as $term) {
                $meta = get_term_meta($term->term_id, 'hpm_lm_layout_settings', true) ?: array();
                ?>
                <tr>
                    <td><?php echo esc_html($term->name); ?></td>
                    <td>
                        <select class="layout-select" data-term-id="<?php echo $term->term_id; ?>" data-taxonomy="<?php echo $taxonomy; ?>">
                            <option value="normal" <?php selected($meta['layout'] ?? 'normal', 'normal'); ?>><?php _e('Normal', $this->text_domain); ?></option>
                            <option value="collection" <?php selected($meta['layout'] ?? 'normal', 'collection'); ?>><?php _e('Collection', $this->text_domain); ?></option>
                            <option value="box" <?php selected($meta['layout'] ?? 'normal', 'box'); ?>><?php _e('Box', $this->text_domain); ?></option>
                        </select>
                    </td>
                    <td>
                        <input type="number" class="mobile-width" data-term-id="<?php echo $term->term_id; ?>" data-taxonomy="<?php echo $taxonomy; ?>" value="<?php echo esc_attr($meta['mobile_width'] ?? ''); ?>" min="10" max="100" placeholder="100" />
                    </td>
                    <td>
                        <input type="number" class="desktop-width" data-term-id="<?php echo $term->term_id; ?>" data-taxonomy="<?php echo $taxonomy; ?>" value="<?php echo esc_attr($meta['desktop_width'] ?? ''); ?>" min="10" max="100" placeholder="100" />
                    </td>
                    <td>
                        <button class="button save-term-settings" data-term-id="<?php echo $term->term_id; ?>" data-taxonomy="<?php echo $taxonomy; ?>"><?php _e('Save', $this->text_domain); ?></button>
                    </td>
                </tr>
                <?php
            }
            echo '</tbody></table>';
        }

        public function add_meta_boxes() {
            add_meta_box(
                'hpm_lm_product_layout',
                __('Product Layout Settings', $this->text_domain),
                array($this, 'product_layout_meta_box'),
                'product',
                'side',
                'default'
            );
        }

        public function product_layout_meta_box($post) {
            wp_nonce_field('hpm_lm_product_layout_nonce', 'hpm_lm_product_layout_nonce');
            $layout = get_post_meta($post->ID, '_hpm_lm_product_layout', true) ?: 'normal';
            $mobile_width = get_post_meta($post->ID, '_hpm_lm_variation_width_mobile', true) ?: '';
            $desktop_width = get_post_meta($post->ID, '_hpm_lm_variation_width_desktop', true) ?: '';
            ?>
            <p>
                <label for="hpm_lm_product_layout"><?php _e('Layout Type:', $this->text_domain); ?></label><br>
                <select id="hpm_lm_product_layout" name="hpm_lm_product_layout" style="width: 100%;">
                    <option value="normal" <?php selected($layout, 'normal'); ?>><?php _e('Normal Layout', $this->text_domain); ?></option>
                    <option value="collection" <?php selected($layout, 'collection'); ?>><?php _e('Collection Layout', $this->text_domain); ?></option>
                    <option value="box" <?php selected($layout, 'box'); ?>><?php _e('Box Layout', $this->text_domain); ?></option>
                </select>
            </p>
            <div id="hpm_lm_width_settings" style="<?php echo $layout === 'box' ? '' : 'display: none;'; ?>">
                <p>
                    <label for="hpm_lm_mobile_width"><?php _e('Mobile Width %:', $this->text_domain); ?></label><br>
                    <input type="number" id="hpm_lm_mobile_width" name="hpm_lm_mobile_width" value="<?php echo esc_attr($mobile_width); ?>" min="10" max="100" placeholder="100" style="width: 100%;" />
                </p>
                <p>
                    <label for="hpm_lm_desktop_width"><?php _e('Desktop Width %:', $this->text_domain); ?></label><br>
                    <input type="number" id="hpm_lm_desktop_width" name="hpm_lm_desktop_width" value="<?php echo esc_attr($desktop_width); ?>" min="10" max="100" placeholder="100" style="width: 100%;" />
                </p>
            </div>
            <script>
                jQuery(document).ready(function($) {
                    $('#hpm_lm_product_layout').change(function() {
                        if ($(this).val() === 'box') {
                            $('#hpm_lm_width_settings').show();
                        } else {
                            $('#hpm_lm_width_settings').hide();
                        }
                    });
                });
            </script>
            <?php
        }

        public function save_product_meta($post_id) {
            if (!isset($_POST['hpm_lm_product_layout_nonce']) || !wp_verify_nonce($_POST['hpm_lm_product_layout_nonce'], 'hpm_lm_product_layout_nonce')) {
                return;
            }
            if (!current_user_can('edit_post', $post_id)) {
                return;
            }
            if (isset($_POST['hpm_lm_product_layout'])) {
                update_post_meta($post_id, '_hpm_lm_product_layout', sanitize_text_field($_POST['hpm_lm_product_layout']));
            }
            if (isset($_POST['hpm_lm_mobile_width'])) {
                update_post_meta($post_id, '_hpm_lm_variation_width_mobile', intval($_POST['hpm_lm_mobile_width']));
            }
            if (isset($_POST['hpm_lm_desktop_width'])) {
                update_post_meta($post_id, '_hpm_lm_variation_width_desktop', intval($_POST['hpm_lm_desktop_width']));
            }
        }

        public function add_category_fields() {
            ?>
            <div class="form-field">
                <label for="hpm_lm_layout"><?php _e('Layout Type', $this->text_domain); ?></label>
                <select name="hpm_lm_layout" id="hpm_lm_layout">
                    <option value="normal"><?php _e('Normal Layout', $this->text_domain); ?></option>
                    <option value="collection"><?php _e('Collection Layout', $this->text_domain); ?></option>
                    <option value="box"><?php _e('Box Layout', $this->text_domain); ?></option>
                </select>
            </div>
            <div class="form-field hpm-lm-width-fields" style="display: none;">
                <label for="hpm_lm_mobile_width"><?php _e('Mobile Width %', $this->text_domain); ?></label>
                <input type="number" name="hpm_lm_mobile_width" id="hpm_lm_mobile_width" min="10" max="100" placeholder="100" />
            </div>
            <div class="form-field hpm-lm-width-fields" style="display: none;">
                <label for="hpm_lm_desktop_width"><?php _e('Desktop Width %', $this->text_domain); ?></label>
                <input type="number" name="hpm_lm_desktop_width" id="hpm_lm_desktop_width" min="10" max="100" placeholder="100" />
            </div>
            <script>
                jQuery(document).ready(function($) {
                    $('#hpm_lm_layout').change(function() {
                        if ($(this).val() === 'box') {
                            $('.hpm-lm-width-fields').show();
                        } else {
                            $('.hpm-lm-width-fields').hide();
                        }
                    });
                });
            </script>
            <?php
        }

        public function edit_category_fields($term) {
            $meta = get_term_meta($term->term_id, 'hpm_lm_layout_settings', true) ?: array();
            ?>
            <tr class="form-field">
                <th scope="row"><label for="hpm_lm_layout"><?php _e('Layout Type', $this->text_domain); ?></label></th>
                <td>
                    <select name="hpm_lm_layout" id="hpm_lm_layout">
                        <option value="normal" <?php selected($meta['layout'] ?? 'normal', 'normal'); ?>><?php _e('Normal Layout', $this->text_domain); ?></option>
                        <option value="collection" <?php selected($meta['layout'] ?? 'normal', 'collection'); ?>><?php _e('Collection Layout', $this->text_domain); ?></option>
                        <option value="box" <?php selected($meta['layout'] ?? 'normal', 'box'); ?>><?php _e('Box Layout', $this->text_domain); ?></option>
                    </select>
                </td>
            </tr>
            <tr class="form-field hpm-lm-width-fields" style="<?php echo ($meta['layout'] ?? 'inherit') === 'box' ? '' : 'display: none;'; ?>">
                <th scope="row"><label for="hpm_lm_mobile_width"><?php _e('Mobile Width %', $this->text_domain); ?></label></th>
                <td>
                    <input type="number" name="hpm_lm_mobile_width" id="hpm_lm_mobile_width" value="<?php echo esc_attr($meta['mobile_width'] ?? ''); ?>" min="10" max="100" placeholder="100" />
                </td>
            </tr>
            <tr class="form-field hpm-lm-width-fields" style="<?php echo ($meta['layout'] ?? 'inherit') === 'box' ? '' : 'display: none;'; ?>">
                <th scope="row"><label for="hpm_lm_desktop_width"><?php _e('Desktop Width %', $this->text_domain); ?></th>
                <td>
                    <input type="number" name="hpm_lm_desktop_width" id="hpm_lm_desktop_width" value="<?php echo esc_attr($meta['desktop_width'] ?? ''); ?>" min="10" max="100" placeholder="100" />
                </td>
            </tr>
            <script>
                jQuery(document).ready(function($) {
                    $('#hpm_lm_layout').change(function() {
                        if ($(this).val() === 'box') {
                            $('.hpm-lm-width-fields').show();
                        } else {
                            $('.hpm-lm-width-fields').hide();
                        }
                    });
                });
            </script>
            <?php
        }

        public function save_category_fields($term_id) {
            if (isset($_POST['hpm_lm_layout'])) {
                $settings = array(
                    'layout' => sanitize_text_field($_POST['hpm_lm_layout']),
                    'mobile_width' => isset($_POST['hpm_lm_mobile_width']) ? intval($_POST['hpm_lm_mobile_width']) : '',
                    'desktop_width' => isset($_POST['hpm_lm_desktop_width']) ? intval($_POST['hpm_lm_desktop_width']) : '',
                );
                update_term_meta($term_id, 'hpm_lm_layout_settings', $settings);
            }
        }

        public function add_tag_fields() {
            $this->add_category_fields();
        }

        public function edit_tag_fields($term) {
            $this->edit_category_fields($term);
        }

        public function save_tag_fields($term_id) {
            $this->save_category_fields($term_id);
        }

        public function register_rest_fields() {
            register_rest_field('product', 'hpm_lm_layout_settings', array(
                'get_callback' => array($this, 'get_product_layout_settings'),
                'schema' => null,
            ));
        }

        public function register_layout_settings_endpoint() {
            register_rest_route(hpm_get_api_namespace(), '/layout-settings', array(
                'methods' => 'GET',
                'callback' => array($this, 'get_layout_settings_endpoint'),
                'permission_callback' => '__return_true',
                'args' => array(
                    'product_id' => array(
                        'required' => true,
                        'validate_callback' => function($param) {
                            return is_numeric($param);
                        }
                    ),
                ),
            ));
        }

        public function get_layout_settings_endpoint($request) {
            $product_id = intval($request->get_param('product_id'));
            if (!$product_id || get_post_type($product_id) !== 'product') {
                return new WP_Error('invalid_product', 'Invalid product ID', array('status' => 400));
            }
            return $this->get_product_layout_settings(array('id' => $product_id));
        }

        public function get_product_layout_settings($product) {
            $product_id = $product['id'];
            // Get product-specific settings
            $layout = get_post_meta($product_id, '_hpm_lm_product_layout', true);
            $mobile_width = get_post_meta($product_id, '_hpm_lm_variation_width_mobile', true);
            $desktop_width = get_post_meta($product_id, '_hpm_lm_variation_width_desktop', true);
            // If no product-specific layout, check categories and tags
            if (empty($layout)) {
                // Get product categories and tags
                $terms = wp_get_post_terms($product_id, ['product_cat', 'product_tag'], ['fields' => 'all']);
                // Check categories first (higher priority)
                $category_terms = array_filter($terms, function($term) {
                    return $term->taxonomy === 'product_cat';
                });
                foreach ($category_terms as $term) {
                    $term_settings = get_term_meta($term->term_id, 'hpm_lm_layout_settings', true);
                    if (!empty($term_settings) && !empty($term_settings['layout'])) {
                        $layout = $term_settings['layout'];
                        $mobile_width = $term_settings['mobile_width'] ?: $mobile_width;
                        $desktop_width = $term_settings['desktop_width'] ?: $desktop_width;
                        break; // Use first category with settings
                    }
                }
                // If still no layout, check tags
                if (empty($layout)) {
                    $tag_terms = array_filter($terms, function($term) {
                        return $term->taxonomy === 'product_tag';
                    });
                    foreach ($tag_terms as $term) {
                        $term_settings = get_term_meta($term->term_id, 'hpm_lm_layout_settings', true);
                        if (!empty($term_settings) && !empty($term_settings['layout'])) {
                            $layout = $term_settings['layout'];
                            $mobile_width = $term_settings['mobile_width'] ?: $mobile_width;
                            $desktop_width = $term_settings['desktop_width'] ?: $desktop_width;
                            break; // Use first tag with settings
                        }
                    }
                }
            }
            // If still no layout, use default
            if (empty($layout)) {
                $default_settings = get_option('hpm_lm_layout_default_settings', array());
                $layout = $default_settings['default_layout'] ?? 'normal';
                $mobile_width = $default_settings['mobile_width'] ?? 100;
                $desktop_width = $default_settings['desktop_width'] ?? 100;
            }
            return array(
                'product_layout' => $layout,
                'variation_width_mobile' => $mobile_width,
                'variation_width_desktop' => $desktop_width,
            );
        }

        public function enqueue_scripts() {
            // Frontend scripts if needed
        }

        public function admin_enqueue_scripts($hook) {
            if ($hook === 'headless-proxy-manager-layout' || strpos($hook, 'headless-proxy-manager-layout') !== false) {
                wp_enqueue_script('hpm-lm-layout-admin-js', 'data:text/javascript;base64,' . base64_encode($this->get_admin_js()), array('jquery'), HPM_LM_VERSION, true);
                wp_localize_script('hpm-lm-layout-admin-js', 'hpmLmLayoutAjax', array(
                    'ajaxurl' => admin_url('admin-ajax.php'),
                    'nonce' => wp_create_nonce('hpm_lm_layout_nonce'),
                ));
            }
        }

        private function get_admin_js() {
            return "
                jQuery(document).ready(function($) {
                    // Save term layout settings
                    $('.save-term-settings').on('click', function(e) {
                        e.preventDefault();
                        var \$button = \$(this);
                        var termId = \$button.data('term-id');
                        var taxonomy = \$button.data('taxonomy');
                        var \$row = \$button.closest('tr');
                        var layout = \$row.find('.layout-select').val();
                        var mobileWidth = \$row.find('.mobile-width').val();
                        var desktopWidth = \$row.find('.desktop-width').val();
                        \$button.prop('disabled', true).text('Saving...');
                        $.ajax({
                            url: hpmLmLayoutAjax.ajaxurl,
                            type: 'POST',
                            data: {
                                action: 'hpm_lm_save_term_layout',
                                nonce: hpmLmLayoutAjax.nonce,
                                term_id: termId,
                                taxonomy: taxonomy,
                                layout: layout,
                                mobile_width: mobileWidth,
                                desktop_width: desktopWidth
                            },
                            success: function(response) {
                                if (response.success) {
                                    \$button.text('Saved!');
                                    setTimeout(function() {
                                        \$button.prop('disabled', false).text('Save');
                                    }, 2000);
                                } else {
                                    alert('Error: ' + response.data);
                                    \$button.prop('disabled', false).text('Save');
                                }
                            },
                            error: function() {
                                alert('AJAX error occurred');
                                \$button.prop('disabled', false).text('Save');
                            }
                        });
                    });
                    // Show/hide width fields based on layout selection
                    $('.layout-select').on('change', function() {
                        var \$row = \$(this).closest('tr');
                        var layout = \$(this).val();
                        if (layout === 'box') {
                            \$row.find('.mobile-width, .desktop-width').prop('disabled', false);
                        } else {
                            \$row.find('.mobile-width, .desktop-width').prop('disabled', true);
                        }
                    });
                    // Initialize disabled state
                    $('.layout-select').each(function() {
                        var \$select = \$(this);
                        var \$row = \$select.closest('tr');
                        var layout = \$select.val();
                        if (layout !== 'box') {
                            \$row.find('.mobile-width, .desktop-width').prop('disabled', true);
                        }
                    });
                });
            ";
        }
    }

    // AJAX handlers for saving term settings
    add_action('wp_ajax_hpm_lm_save_term_layout', 'hpm_lm_save_term_layout_callback');
    function hpm_lm_save_term_layout_callback() {
        check_ajax_referer('hpm_lm_layout_nonce', 'nonce');
        if (!current_user_can('manage_woocommerce')) {
            wp_die(__('Insufficient permissions', 'headless-proxy-manager'));
        }
        $term_id = intval($_POST['term_id']);
        $taxonomy = sanitize_text_field($_POST['taxonomy']);
        $layout = sanitize_text_field($_POST['layout']);
        $mobile_width = intval($_POST['mobile_width']);
        $desktop_width = intval($_POST['desktop_width']);
        $settings = array(
            'layout' => $layout,
            'mobile_width' => $mobile_width,
            'desktop_width' => $desktop_width,
        );
        update_term_meta($term_id, 'hpm_lm_layout_settings', $settings);
        wp_send_json_success(__('Settings saved successfully', 'headless-proxy-manager'));
    }

    // ==============================================
    // End of Layout Manager Features
    // ==============================================

    // Instantiate both classes
    new Headless_Proxy_Manager();
    new HPM_Product_FAQs();
    new HPM_Custom_Labels();
    new HPM_Variation_Extras();
    new HPM_Layout_Manager();

    // CORS preflight handler (OPTIONS) kept for compatibility
    add_action('init', function(){
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS' && isset($_SERVER['REQUEST_URI'])) {
            $ns = hpm_get_api_namespace();
            $prefix = '/wp-json/' . $ns . '/';
            if (strpos($_SERVER['REQUEST_URI'], $prefix) !== false) {
                header('Access-Control-Allow-Origin: *');
                header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
                header('Access-Control-Allow-Headers: Content-Type, Accept, X-HPM-Secret, x-hpm-secret, Authorization, X-Requested-With, X-WP-Nonce');
                header('Access-Control-Allow-Credentials: false');
                header('Access-Control-Max-Age: 86400');
                header('Content-Type: application/json');
                http_response_code(200);
                echo '{}';
                exit;
            }
        }
    }, 0);

    // Expose headers on REST responses using rest_pre_serve_request (ensures CORS & security headers present)
    add_action('rest_api_init', function(){
        add_filter('rest_pre_serve_request', function($served, $result, $request, $server){
            $route = $request->get_route();
            $ns = hpm_get_api_namespace();
            $prefix = '/' . $ns . '/';
            if (strpos($route, $prefix) === 0) {
                header('Access-Control-Allow-Origin: *');
                header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
                header('Access-Control-Allow-Headers: Content-Type, Accept, X-HPM-Secret, x-hpm-secret, Authorization, X-Requested-With, X-WP-Nonce');
                header('Access-Control-Expose-Headers: X-WP-Total, X-WP-TotalPages');
                header('Access-Control-Allow-Credentials: false');
                header('Access-Control-Max-Age: 86400');
                header('X-Content-Type-Options: nosniff');
                header('X-Frame-Options: DENY');
                header('X-XSS-Protection: 1; mode=block');
            }
            return $served;
        }, 10, 4);
    });

    // Support quick clearing when clicking admin-bar link
    add_action('admin_init', function(){
        if (isset($_GET['hpm_clear_cache']) && current_user_can('manage_options')) {
            check_admin_referer('hpm_clear_cache');
            $hpm = new Headless_Proxy_Manager();
            $hpm->clear_proxy_cache();
            wp_safe_redirect(remove_query_arg(array('hpm_clear_cache','_wpnonce')));
            exit;
        }
    });

    // Activation hook (combined for both features)
    register_activation_hook(__FILE__, 'hpm_activate');
    function hpm_activate() {
        // Original proxy activation (if any)
        // Layout default options
        add_option('hpm_lm_layout_default_settings', array(
            'default_layout' => 'normal',
            'mobile_width' => 100,
            'desktop_width' => 100,
        ));
        // Initialize HSEO database tables
        hpm_create_hseo_tables();
        // Flush rewrite rules
        flush_rewrite_rules();
    }
    
    /**
     * Create HSEO database tables
     */
    function hpm_create_hseo_tables() {
        global $wpdb;
        $charset_collate = $wpdb->get_charset_collate();
        $table_name = $wpdb->prefix . 'hseo_data';
        
        $sql = "CREATE TABLE IF NOT EXISTS $table_name (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            object_id bigint(20) NOT NULL,
            object_type varchar(20) NOT NULL,
            route_path varchar(255) NOT NULL,
            meta_title text,
            meta_description text,
            meta_keywords text,
            og_title text,
            og_description text,
            og_image varchar(500),
            og_type varchar(50) DEFAULT 'website',
            twitter_title text,
            twitter_description text,
            twitter_image varchar(500),
            twitter_card varchar(50) DEFAULT 'summary_large_image',
            robots_index varchar(10) DEFAULT 'index',
            robots_follow varchar(10) DEFAULT 'follow',
            canonical_url varchar(500),
            schema_type varchar(50),
            schema_data longtext,
            faq_data longtext,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY object_route (object_id, object_type, route_path),
            KEY route_path (route_path),
            KEY object_lookup (object_id, object_type)
        ) $charset_collate;";
        
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);
    }

    // Deactivation hook
    register_deactivation_hook(__FILE__, 'hpm_deactivate');
    function hpm_deactivate() {
        // Flush rewrite rules
        flush_rewrite_rules();
    }
    ?>
