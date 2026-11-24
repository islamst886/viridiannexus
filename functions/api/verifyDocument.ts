import {
  handleVerifyDocumentRequest,
  type VerifyDocumentEnv,
} from '../../src/utils/documentVerificationServer.js';

interface CloudflareEventContext {
  request: Request;
  env: VerifyDocumentEnv;
}

export const onRequest = async (context: CloudflareEventContext): Promise<Response> => {
  return handleVerifyDocumentRequest(context.request, context.env);
};
