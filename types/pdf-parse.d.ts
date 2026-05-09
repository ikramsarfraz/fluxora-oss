declare module "pdf-parse" {
  type PdfParseResult = {
    numpages: number;
    numrender: number;
    info: unknown;
    metadata: unknown;
    text: string;
    version: string;
  };

  function pdfParse(
    dataBuffer: Buffer,
    options?: {
      max?: number;
      version?: string;
      pagerender?: (pageData: unknown) => Promise<string> | string;
    },
  ): Promise<PdfParseResult>;

  export = pdfParse;
}
