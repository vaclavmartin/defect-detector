import DefectDetector from "./components/DefectDetector";

export default function Home() {
  return (
    <div className="flex min-h-screen items-start justify-center bg-zinc-50 p-6 font-sans dark:bg-black">
      <main className="w-full max-w-6xl rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 dark:bg-black dark:ring-zinc-800">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Defect Detector</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Upload an image or load the sample, then adjust minimum spot size and contrast.
          </p>
        </div>
        <DefectDetector />
      </main>
    </div>
  );
}
