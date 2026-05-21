'use client';

import { useState } from 'react';

export default function UploadTrigger({ accountName }: { accountName: string }) {
  const [loading, setLoading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setLoading(true);

    const file = e.target.files[0];
    const rawText = await file.text(); // Assuming your existing flow handles text extraction

    try {
      const response = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText, accountName }),
      });

      if (response.ok) {
        alert("Statement ingested and reconciled successfully!");
        window.location.reload(); // Refresh to show new data
      }
    } catch (err) {
      console.error("Ingestion failed", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded">
      <input type="file" onChange={handleFileUpload} disabled={loading} />
      {loading && <p>Processing and Reconciling...</p>}
    </div>
  );
}