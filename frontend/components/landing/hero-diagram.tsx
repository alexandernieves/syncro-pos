import { Beef, Coffee, Croissant, Hamburger, Pill, Store, Shirt, Wrench } from "lucide-react";

/**
 * Hero node diagram: Syncro at the centre, feeding the kinds of businesses
 * that run on it. A static line runs from the mark's edge to each business,
 * and an oval "nutrient" loops along it, start to finish. Laid out on a
 * 1800x480 grid; every position below is a percentage of it, so the whole
 * thing scales with the page.
 */
const W = 1800;
const H = 480;
const pctX = (x: number) => `${(x / W) * 100}%`;
const pctY = (y: number) => `${(y / H) * 100}%`;

const HUB = { x: 900, y: 240, size: 220 };
// Every line on a side leaves from the same single point, right at the
// mark's own notch, and fans out from there — not from its own spot
// scattered around a circle.
const HUB_EDGE = HUB.size * 0.29;
const LEFT_ATTACH = { x: HUB.x - HUB_EDGE, y: HUB.y };
const RIGHT_ATTACH = { x: HUB.x + HUB_EDGE, y: HUB.y };

type Node = {
  id: string;
  label: string;
  x: number;
  y: number;
  size: number;
  icon: typeof Croissant;
  from: string;
  to: string;
  fg: string;
};

const NODES: Node[] = [
  { id: "panaderia", label: "Panaderías", x: 470, y: 66, size: 112, icon: Croissant, from: "#F7DA9C", to: "#EBB65C", fg: "#5B3B12" },
  { id: "ferreteria", label: "Ferreterías", x: 185, y: 192, size: 132, icon: Wrench, from: "#AABCC7", to: "#7E97A6", fg: "#FFFFFF" },
  { id: "boutique", label: "Boutiques", x: 205, y: 366, size: 118, icon: Shirt, from: "#F7BBD7", to: "#EE93BB", fg: "#FFFFFF" },
  { id: "bodega", label: "Bodegas", x: 470, y: 456, size: 100, icon: Store, from: "#98DCAA", to: "#67C480", fg: "#FFFFFF" },
  { id: "hamburgueseria", label: "Hamburgueserías", x: 1330, y: 66, size: 112, icon: Hamburger, from: "#F6A28A", to: "#ED7250", fg: "#FFFFFF" },
  { id: "farmacia", label: "Farmacias", x: 1615, y: 192, size: 132, icon: Pill, from: "#FFFFFF", to: "#DCEFEA", fg: "#189881" },
  { id: "carniceria", label: "Carnicerías", x: 1595, y: 366, size: 118, icon: Beef, from: "#F2948C", to: "#DD5A4E", fg: "#FFFFFF" },
  { id: "cafeteria", label: "Cafeterías", x: 1330, y: 456, size: 100, icon: Coffee, from: "#D0AA8C", to: "#B07F5C", fg: "#FFFFFF" },
];

/** The dogleg curve from the mark's notch out to a business tile. */
function lineFor(n: Node) {
  const { x: sx, y: sy } = n.x < HUB.x ? LEFT_ATTACH : RIGHT_ATTACH;
  const midX = (sx + n.x) / 2;
  return `M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${n.y}, ${n.x} ${n.y}`;
}

export function HeroDiagram() {
  return (
    <div className="relative mx-auto h-[260px] w-full overflow-hidden sm:h-[340px] lg:h-auto lg:overflow-visible" aria-hidden>
      <div
        className="absolute left-1/2 top-0 w-[max(100%,900px)] -translate-x-1/2 lg:relative lg:left-auto lg:w-full lg:translate-x-0"
        style={{ aspectRatio: `${W} / ${H}` }}
      >
        <div className="absolute inset-0">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="animate-in fade-in fill-mode-backwards absolute inset-0 h-full w-full duration-1000"
            style={{ animationDelay: "300ms" }}
          >
            <defs>
              <filter id="syncro-glow" x="-200%" y="-200%" width="500%" height="500%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="3.2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <g fill="none" stroke="#D3CFC4" strokeWidth="1.6" strokeLinecap="round">
              {NODES.map((n) => (
                <path key={n.id} id={`syncro-line-${n.id}`} d={lineFor(n)} vectorEffect="non-scaling-stroke" />
              ))}
            </g>

            {NODES.map((n, i) => (
              <ellipse key={`dot-${n.id}`} rx="4.5" ry="1.7" fill={n.to} filter="url(#syncro-glow)">
                <animateMotion dur={`${2.4 + i * 0.2}s`} begin={`${i * 0.15}s`} repeatCount="indefinite" rotate="auto">
                  <mpath href={`#syncro-line-${n.id}`} />
                </animateMotion>
              </ellipse>
            ))}
          </svg>

          {/* centre: Syncro — positioning and entrance animation kept on
              separate elements, so the enter keyframe's transform never
              fights the centring translate. */}
          <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: pctX(HUB.x), top: pctY(HUB.y), width: pctX(HUB.size) }}>
            <img
              src="/conect.png"
              alt="Syncro"
              className="animate-in fade-in zoom-in-50 fill-mode-backwards block w-full duration-700"
            />
          </div>

          {NODES.map((n, i) => {
            const Icon = n.icon;
            return (
              <div
                key={n.id}
                title={n.label}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: pctX(n.x), top: pctY(n.y), width: pctX(n.size) }}
              >
                <div
                  className="animate-in fade-in zoom-in-75 fill-mode-backwards flex flex-col items-center duration-500"
                  style={{ animationDelay: `${450 + i * 70}ms` }}
                >
                  <div
                    className="grid aspect-square w-full place-items-center rounded-[12%]"
                    style={{ backgroundImage: `linear-gradient(180deg, ${n.from}, ${n.to})`, color: n.fg }}
                  >
                    <Icon className="size-[42%]" strokeWidth={1.6} />
                  </div>
                  <span className="mt-2 whitespace-nowrap text-[11px] font-semibold text-[#6B665B] sm:text-xs">
                    {n.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
