import { cn } from "@/lib/utils";

interface BrandMarkProps {
  className?: string;
}

const BrandMark = ({ className }: BrandMarkProps) => {
  return (
    <img
      src="/playpal-mark.svg"
      alt="PlayPal"
      className={cn("object-contain", className)}
    />
  );
};

export default BrandMark;
