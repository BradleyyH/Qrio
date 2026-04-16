import QRGenerator from "./QRGenerator";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-12 md:py-20">
      <div className="w-full max-w-5xl">
        <header className="text-center mb-10 md:mb-14">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-neutral-900">
            QR Maker
          </h1>
          <p className="mt-3 text-neutral-500 text-base md:text-lg">
            Custom QR codes with custom designs.
          </p>
        </header>
        <QRGenerator />
      </div>
    </main>
  );
}
