import Image from "next/image";
export default function Logo({ white = false, className = "h-6 w-auto" }: { white?: boolean; className?: string }) {
  return <Image src={white ? "/img/marca/logo-white.png" : "/img/marca/logo-black.png"} alt="BORA" width={200} height={52} className={className} priority />;
}
