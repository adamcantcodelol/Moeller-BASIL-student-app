import { DEMO_BANNER_LABEL } from "@/types/demo";

export function DemoBanner({ show }: { show: boolean }) {
  if (!show) {
    return null;
  }

  return (
    <div className="demo-banner" role="status">
      {DEMO_BANNER_LABEL}
    </div>
  );
}
