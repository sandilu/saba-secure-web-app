export function downloadCsv(filename, rows) {
  const process = rows.map((row) =>
    row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")
  );
  const csvContent = process.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
