import { test } from 'node:test';
import assert from 'node:assert/strict';
import { APIError, graphqlError, restError } from './apiErrors.ts';

test('a GraphQL error is classified by its extensions.code, not its message', () => {
  const error = graphqlError('Event', [{ message: 'Not found', extensions: { code: 'NOT_FOUND' } }]);
  assert.equal(error.code, 'NOT_FOUND');
  assert.equal(error.status, 404);
  assert.equal(error.notFound, true);
  assert.equal(error.signedOut, false);
  assert.equal(error.message, 'Event failed: Not found');

  const signedOut = graphqlError('ReportLocation', [{ message: 'Sign in first', extensions: { code: 'UNAUTHENTICATED' } }]);
  assert.equal(signedOut.signedOut, true);
  assert.equal(signedOut.status, 401);
});

test('per-field messages ride under extensions.fields', () => {
  const error = graphqlError('Save', [{ message: 'Invalid', extensions: { code: 'INVALID', fields: { name: ["can't be blank"] } } }]);
  assert.equal(error.status, 422);
  assert.deepEqual(error.fields, { name: ["can't be blank"] });
});

test('the API code wins over graphql-ruby\'s own, and an unknown code reads as a server failure', () => {
  const mixed = graphqlError('Venue', [
    { message: 'Field "x" doesn\'t exist', extensions: { code: 'undefinedField' } },
    { message: 'Nope', extensions: { code: 'FORBIDDEN', reason: 'banned' } },
  ]);
  assert.equal(mixed.code, 'FORBIDDEN');
  assert.equal(mixed.reason, 'banned');
  assert.equal(mixed.status, 403);

  const unknown = graphqlError('Venue', [{ message: 'Field "x" doesn\'t exist', extensions: { code: 'undefinedField' } }]);
  assert.equal(unknown.code, 'undefinedField');
  assert.equal(unknown.status, 500);
  assert.equal(unknown.reportable, false);

  const bare = graphqlError('Venue', [{ message: 'boom' }]);
  assert.equal(bare.code, undefined);
  assert.equal(bare.status, 500);
  assert.equal(bare.reportable, true);
});

test('a REST refusal carries its code and the server\'s message', () => {
  const refused = restError('POST', '/v1/token', 400, { error: 'INVALID', message: 'Facebook refused the token' });
  assert.equal(refused.code, 'INVALID');
  assert.equal(refused.message, 'Facebook refused the token');
  assert.equal(refused.status, 400);

  const empty = restError('POST', '/v1/token', 401, {});
  assert.equal(empty.message, 'POST /v1/token failed with 401');
  assert.equal(empty.signedOut, true);

  const text = restError('GET', '/v1/branding', 502, undefined);
  assert.equal(text.status, 502);
  assert.equal(text.reportable, true);
});

test('transient failures are retried later, not reported', () => {
  assert.equal(new APIError(503, 'down', 'UNAVAILABLE').transient, true);
  assert.equal(new APIError(503, 'down', 'UNAVAILABLE').reportable, false);
  assert.equal(new APIError(429, 'slow down', 'RATE_LIMITED').transient, true);
  assert.equal(new APIError(500, 'boom', 'INTERNAL').reportable, true);
  assert.equal(new APIError(404, 'gone', 'NOT_FOUND').reportable, false);
});
