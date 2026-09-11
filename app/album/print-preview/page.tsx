import { MonthlyAlbumPrintPreview } from "@/components/monthly-album-print-preview";
import "./monthly-print.css";

export default async function MonthlyPrintPage({ searchParams }: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const validMonth = typeof month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : null;
  return <MonthlyAlbumPrintPreview key={validMonth ?? "invalid"} month={validMonth} />;
}
