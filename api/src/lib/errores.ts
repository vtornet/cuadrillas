export class ErrorHttp extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export class BillingNoConfigurado extends ErrorHttp {
  constructor() {
    super(503, "Los pagos no estan configurados en el servidor");
  }
}
