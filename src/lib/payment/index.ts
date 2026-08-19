import { AlipayProvider } from "./alipay";
import { MockPaymentProvider } from "./mock";
import { WechatPayProvider } from "./wechat";
import { StripePaymentProvider } from "./stripe";
import { PaymentProvider } from "./types";

const providers: PaymentProvider[] = [new WechatPayProvider(), new AlipayProvider(), new StripePaymentProvider()];
export function getPaymentProviders(): PaymentProvider[] {
  if (process.env.PAYMENT_PROVIDER === "mock") return [new MockPaymentProvider()];
  return providers.filter((provider) => provider.configured());
}
export function getPaymentProvider(name: string): PaymentProvider | undefined { return getPaymentProviders().find((provider) => provider.name === name); }
export * from "./types";
