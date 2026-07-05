<?php
/**
 * A small OAuth 2.1 authorization server for the official cloud connector
 * (mcp.wpistic.cloud). This is intentionally NOT a general-purpose dynamic
 * client registry - there is exactly one recognized client (the cloud
 * connector itself), identified by CLIENT_ID. Everything it issues is a
 * normal Bridgistic key (via KeyStore::create()), so the existing
 * HMAC/Guard/Scopes pipeline is completely unchanged - this class only adds
 * a browser-friendly, no-copy-paste way to mint one.
 *
 * There is deliberately no client secret here. The Worker is a "public
 * client" (RFC 6749 section 2.1) to every WordPress site it has never seen
 * before - there is no way to pre-share a secret with an install it doesn't
 * know about yet, and OAuth 2.1 explicitly designed PKCE to secure exactly
 * this kind of client. The single-use code + PKCE S256 challenge are the
 * real security boundary, not a shared secret.
 *
 * Flow:
 *   1. Cloud Worker redirects the admin's browser here with a PKCE challenge.
 *   2. issue_code() renders a consent screen and, on approval, mints a
 *      single-use authorization code bound to that challenge + the chosen
 *      permission preset.
 *   3. The Worker calls redeem_code() server-to-server with the matching
 *      PKCE verifier and receives a real Bridgistic key.
 *
 * @package Bridgistic
 */

declare( strict_types=1 );

namespace Bridgistic;

use Bridgistic\Admin\Presets;
use Bridgistic\Security\KeyStore;
use Bridgistic\Security\Scopes;
use WP_Error;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Oauth {

	/** The one recognized client. Not a dynamic registry. */
	public const CLIENT_ID = 'bridgistic-cloud';

	/** Hosts an authorize redirect_uri is allowed to point at. */
	private const ALLOWED_REDIRECT_HOSTS = array( 'mcp.wpistic.cloud' );

	/** Authorization codes expire quickly and are single-use. */
	private const CODE_TTL = 300;

	/**
	 * Validate a redirect_uri against the allowed cloud connector host(s).
	 * https-only; exact host match (no subdomain wildcards).
	 */
	public static function redirect_uri_allowed( string $redirect_uri ): bool {
		$parts = wp_parse_url( $redirect_uri );
		if ( ! $parts || ( $parts['scheme'] ?? '' ) !== 'https' ) {
			return false;
		}
		return in_array( $parts['host'] ?? '', self::ALLOWED_REDIRECT_HOSTS, true );
	}

	/**
	 * Step 2: mint a single-use authorization code after the admin approves.
	 *
	 * @param array<int,string> $scopes Scopes granted (from the chosen preset).
	 */
	public static function issue_code( string $redirect_uri, string $code_challenge, array $scopes, bool $require_approval ): string {
		$code      = bin2hex( random_bytes( 32 ) );
		$transient = 'bridgistic_oauth_code_' . hash( 'sha256', $code );

		set_transient(
			$transient,
			array(
				'redirect_uri'     => $redirect_uri,
				'code_challenge'   => $code_challenge,
				'scopes'           => array_values( $scopes ),
				'require_approval' => $require_approval,
				'created_at'       => time(),
			),
			self::CODE_TTL
		);

		return $code;
	}

	/**
	 * Step 3: the Worker exchanges a code (+ PKCE verifier) for a freshly
	 * minted Bridgistic key. Single-use - the transient is deleted whether
	 * or not the exchange succeeds.
	 *
	 * @return array{site_url:string,key_id:string,key_secret:string,scopes:array<int,string>}|WP_Error
	 */
	public static function redeem_code( string $code, string $client_id, string $redirect_uri, string $code_verifier ) {
		if ( self::CLIENT_ID !== $client_id ) {
			return new WP_Error( 'bridgistic_oauth_client', 'Unknown client_id.', array( 'status' => 400 ) );
		}

		$transient = 'bridgistic_oauth_code_' . hash( 'sha256', $code );
		$data      = get_transient( $transient );
		delete_transient( $transient ); // Single-use regardless of outcome.

		if ( ! is_array( $data ) ) {
			return new WP_Error( 'bridgistic_oauth_grant', 'Authorization code is invalid, expired, or already used.', array( 'status' => 400 ) );
		}
		if ( ! hash_equals( (string) $data['redirect_uri'], $redirect_uri ) ) {
			return new WP_Error( 'bridgistic_oauth_grant', 'redirect_uri does not match the authorization request.', array( 'status' => 400 ) );
		}

		// PKCE S256 verification (RFC 7636). Only S256 is accepted.
		$computed = rtrim( strtr( base64_encode( hash( 'sha256', $code_verifier, true ) ), '+/', '-_' ), '=' );
		if ( ! hash_equals( (string) $data['code_challenge'], $computed ) ) {
			return new WP_Error( 'bridgistic_oauth_grant', 'PKCE verification failed.', array( 'status' => 400 ) );
		}

		$scopes  = Scopes::sanitize( (array) $data['scopes'] );
		$created = KeyStore::create(
			'Cloud connector - mcp.wpistic.cloud',
			$scopes,
			array(),
			120,
			(bool) $data['require_approval'],
			'custom',
			0
		);

		return array(
			'site_url'   => home_url(),
			'key_id'     => $created['key_id'],
			'key_secret' => $created['secret'],
			'scopes'     => $scopes,
		);
	}

	/**
	 * Resolve the preset for the consent screen; defaults to read_only if
	 * the requested preset id is unknown so a bad/forged param can't
	 * silently grant more than expected.
	 *
	 * @return array<string,mixed>
	 */
	public static function preset_or_default( string $preset_id ): array {
		return Presets::get( $preset_id ) ?? Presets::get( 'read_only' );
	}
}
