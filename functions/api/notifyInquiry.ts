import {
  handleNotifyInquiryRequest,
  type NotifyInquiryEnv,
} from '../../src/utils/inquiryWhatsAppServer.js';

interface CloudflareEventContext {
  request: Request;
  env: NotifyInquiryEnv;
}

export const onRequest = async (context: CloudflareEventContext): Promise<Response> => {
  return handleNotifyInquiryRequest(context.request, context.env);
};
