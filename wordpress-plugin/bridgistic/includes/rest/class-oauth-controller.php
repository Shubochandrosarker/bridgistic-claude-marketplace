<?php
/**
 * OAuth token endpoint - the only public (non-HMAC) route in the bridge.
 * Server-to-server only: the cloud Worker calls this to exchange an
 * authorization code (minted by the wp-admin consent screen, see
 * Bridgistic\Admin\OAuthAuthorizePage) for a real Bridgistic key.
 *
 * Deliberately does NOT go through Controller::authenticate() - there is no
 * HMAC key yet at this point, that's the whole point of this endpoint. PKCE
 * (verified inside Oauth::redeem_code()) is what makes this safe to expose
 * without a client secret - see the docblock on Bridgistic\Oauth.
 *
 * @package Bridgistic
 */

declare( strict_types=1 );

namespace Bridgistic\Rest;

use Bridgistic\Oauth;
use WP_Error;
use WP_REST_Request;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class OauthController {

	public function register( string $namespace ): void {
		register_rest_route(
			$namespace,
			'/oauth/token',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'token' ),
				'permission_callback' => '__return_true',
			)
		);
	}

	public function token( WP_REST_Request $request ) {
		$grant_type = (string) $request->get_param( 'grant_type' );
		if ( 'authorization_code' !== $grant_type ) {
			return new WP_Error( 'bridgistic_oauth_grant_type', 'Only grant_type=authorization_code is supported.', array( 'status' => 400 ) );
		}

		$code          = (string) $request->get_param( 'code' );
		$client_id     = (string) $request->get_param( 'client_id' );
		$redirect_uri  = (string) $request->get_param( 'redirect_uri' );
		$code_verifier = (string) $request->get_param( 'code_verifier' );

		if ( '' === $code || '' === $client_id || '' === $redirect_uri || '' === $code_verifier ) {
			return new WP_Error( 'bridgistic_oauth_params', 'Missing required OAuth parameters.', array( 'status' => 400 ) );
		}

		$result = Oauth::redeem_code( $code, $client_id, $redirect_uri, $code_verifier );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return new \WP_REST_Response( $result, 200 );
	}
}
