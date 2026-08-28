/**
 * JSON media-type widening tests (compile-time assertions).
 *
 * These tests never run — validated by `npm run types:test` (tsc --noEmit).
 *
 * Uses inline operation type literals that mirror openapi-typescript output.
 * Covered cases:
 *  1. `application/json; charset=utf-8` request body and response
 *  2. `application/vnd.api+json` request body and response
 *  3. Exact `application/json` wins over a `+json` variant in the same content map
 *  4. Non-JSON content still yields `never` (request) / `unknown` (response)
 *  5. multipart/form-data fallback is preserved
 */

import type { ApiRequest, ApiResponse } from '@qualisero/openapi-endpoint'

/** Mutual-identity equality check (catches the `never` / `unknown` cases). */
type Eq<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false

interface Widget {
  id: string
  name: string
}

interface AltWidget {
  alt: string
}

interface Ops {
  charsetOp: {
    requestBody: { content: { 'application/json; charset=utf-8': Widget } }
    responses: { 200: { content: { 'application/json; charset=utf-8': Widget } } }
  }
  vndOp: {
    requestBody: { content: { 'application/vnd.api+json': Widget } }
    responses: { 200: { content: { 'application/vnd.api+json': Widget } } }
  }
  bothOp: {
    requestBody: { content: { 'application/vnd.api+json': AltWidget; 'application/json': Widget } }
    responses: { 200: { content: { 'application/vnd.api+json': AltWidget; 'application/json': Widget } } }
  }
  textOp: {
    requestBody: { content: { 'text/plain': string } }
    responses: { 200: { content: { 'text/plain': string } } }
  }
  multipartOp: {
    requestBody: { content: { 'multipart/form-data': Widget } }
    responses: { 204: { content?: never } }
  }
}

// 1. charset parameter on application/json
const _charsetRequest: Eq<ApiRequest<Ops, 'charsetOp'>, Widget> = true
const _charsetResponse: Eq<ApiResponse<Ops, 'charsetOp'>, Required<Widget>> = true

// 2. +json structured-syntax suffix
const _vndRequest: Eq<ApiRequest<Ops, 'vndOp'>, Widget> = true
const _vndResponse: Eq<ApiResponse<Ops, 'vndOp'>, Required<Widget>> = true

// 3. exact application/json wins over the +json variant
const _bothRequest: Eq<ApiRequest<Ops, 'bothOp'>, Widget> = true
const _bothResponse: Eq<ApiResponse<Ops, 'bothOp'>, Required<Widget>> = true

// 4. non-JSON content is not widened
const _textRequest: Eq<ApiRequest<Ops, 'textOp'>, never> = true

// 5. multipart fallback preserved
const _multipartRequest: Eq<ApiRequest<Ops, 'multipartOp'>, Widget | FormData> = true

export {}
