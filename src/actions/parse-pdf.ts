"use server";

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export async function parsePdf(formData: FormData) {
  try {
    const file = formData.get("file") as File;

    if (!file) {
      throw new Error("No file provided");
    }

    const loadingTask = getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    });

    try {
      const pdf = await loadingTask.promise;
      const pages: string[] = [];

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        if (content.items.length === 0) {
          continue;
        }

        let lastY: number | undefined;
        const textItems: string[] = [];
        for (const item of content.items) {
          if ("str" in item) {
            textItems.push(lastY === item.transform[5] || !lastY ? item.str : `\n${item.str}`);
            lastY = item.transform[5];
          }
        }
        pages.push(textItems.join(""));
      }

      return { success: true, text: pages.join("\n") };
    } finally {
      await loadingTask.destroy();
    }
  } catch (error) {
    console.error("Error parsing PDF:", error);

    return {
      success: false,
      error: "Failed to parse PDF",
    };
  }
}
