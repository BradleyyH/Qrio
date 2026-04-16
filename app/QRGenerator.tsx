"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { renderQR, renderQRToBlob, type Style } from "@/lib/renderQR";

type LogoChoice = "none" | "upload";

export default function QRGenerator() {
  const [url, setUrl] = useState("https://example.com");
  const [style, setStyle] = useState<Style>("square");
  const [logoChoice, setLogoChoice] = useState<LogoChoice>("none");
  const [color, setColor] = useState("#1a1a2e");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isValidHex = /^#[0-9a-fA-F]{6}$/.test(color);
  const useLogo = logoChoice === "upload" && logoImg !== null;

  // Load uploaded file into an HTMLImageElement
  useEffect(() => {
    if (!logoFile) {
      setLogoImg(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => setLogoImg(img);
      img.onerror = () => setError("Failed to load logo image.");
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(logoFile);
  }, [logoFile]);

  // Live preview — regenerate on any input change
  useEffect(() => {
    if (!canvasRef.current) return;
    if (!url.trim() || !isValidHex) {
      setReady(false);
      return;
    }
    try {
      renderQR(
        {
          text: url,
          style,
          fg: color,
          bg: "#ffffff",
          logo: useLogo ? logoImg : null,
        },
        canvasRef.current,
      );
      setError(null);
      setReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate QR.");
      setReady(false);
    }
  }, [url, style, color, useLogo, logoImg, isValidHex]);

  const handleDownload = useCallback(async () => {
    if (!ready || !url.trim() || !isValidHex) return;
    try {
      const blob = await renderQRToBlob({
        text: url,
        style,
        fg: color,
        bg: "#ffffff",
        logo: useLogo ? logoImg : null,
      });
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = "qrcode.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export image.");
    }
  }, [ready, url, style, color, useLogo, logoImg, isValidHex]);

  return (
    <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6 md:gap-10 bg-white/70 backdrop-blur-sm border border-neutral-200/70 rounded-3xl shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.08)] p-6 md:p-10">
      {/* Controls */}
      <div className="space-y-7">
        <Field label="Destination">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full h-11 px-3.5 rounded-xl border border-neutral-200 bg-white text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 transition"
          />
        </Field>

        <div className="grid grid-cols-2 gap-5">
          <Field label="Style">
            <Segmented
              value={style}
              onChange={(v) => setStyle(v as Style)}
              options={[
                { value: "square", label: "Default" },
                { value: "circles", label: "Circle" },
              ]}
            />
          </Field>

          <Field label="Logo">
            <Segmented
              value={logoChoice}
              onChange={(v) => setLogoChoice(v as LogoChoice)}
              options={[
                { value: "none", label: "None" },
                { value: "upload", label: "Upload" },
              ]}
            />
          </Field>
        </div>

        {logoChoice === "upload" && (
          <Field label="Logo file">
            <label className="group flex items-center gap-3 h-11 px-3.5 rounded-xl border border-dashed border-neutral-300 hover:border-neutral-400 bg-neutral-50/50 cursor-pointer transition">
              <span className="flex-1 text-sm text-neutral-600 truncate">
                {logoFile ? logoFile.name : "Click to choose an image"}
              </span>
              <span className="text-xs text-neutral-500 group-hover:text-neutral-700 transition">
                Browse
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </label>
          </Field>
        )}

        <Field label="Colour">
          <div className="flex items-center gap-2.5">
            <div className="relative h-11 w-11 rounded-xl border border-neutral-200 overflow-hidden shrink-0">
              <input
                type="color"
                value={isValidHex ? color : "#000000"}
                onChange={(e) => setColor(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer border-none"
                aria-label="Colour picker"
              />
            </div>
            <input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="#1a1a2e"
              className={`flex-1 h-11 px-3.5 rounded-xl border bg-white font-mono text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 transition ${
                isValidHex ? "border-neutral-200" : "border-red-400"
              }`}
            />
          </div>
        </Field>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>

      {/* Preview */}
      <div className="flex flex-col">
        <div className="flex-1 flex items-center justify-center aspect-square md:aspect-auto md:min-h-[360px] rounded-2xl bg-neutral-50 border border-neutral-200/70 p-4 md:p-6">
          <canvas
            ref={canvasRef}
            className={`max-w-full max-h-full h-auto w-auto rounded-md transition-opacity duration-200 ${
              ready ? "opacity-100" : "opacity-0"
            }`}
          />
        </div>

        <button
          onClick={handleDownload}
          disabled={!ready}
          className="mt-4 h-12 w-full rounded-xl bg-neutral-900 text-white font-medium hover:bg-neutral-800 active:bg-neutral-900 disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed transition"
        >
          Download PNG
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <span className="block text-[13px] font-medium text-neutral-700">
        {label}
      </span>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex w-full rounded-xl bg-neutral-100 p-1">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 h-9 text-sm font-medium rounded-lg transition ${
              active
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
