import { useState, useEffect, useMemo } from "react";
import postsData from "../../../posts.json";

// --- Types ---
interface RawResolution {
  url: string;
  width: number;
  height: number;
}

interface RawPost {
  id: string;
  title: string;
  url: string;
  preview?: {
    images?: Array<{
      source: RawResolution;
      resolutions: RawResolution[];
    }>;
  };
}

interface Post {
  id: string;
  title: string;
  thumbUrl: string;
  fullUrl: string;
  aspectRatio: number;
  sourceWidth: number;
  sourceHeight: number;
}

interface ColumnLayout {
  count: number;
  colWidth: number;
}

// --- Parse and normalize posts from Reddit JSON ---
function parsePosts(raw: RawPost[]): Post[] {
  return raw
    .filter((p) => p.preview?.images?.[0])
    .map((p) => {
      const source = p.preview!.images![0].source;
      const resolutions = p.preview!.images![0].resolutions;

      const thumb =
        resolutions.find((r) => r.width === 640) ||
        resolutions[resolutions.length - 1] ||
        source;

      return {
        id: p.id,
        title: p.title,
        thumbUrl: thumb.url.replaceAll("&amp;", "&"),
        fullUrl: p.url,
        aspectRatio: source.width / source.height,
        sourceWidth: source.width,
        sourceHeight: source.height,
      };
    });
}

const POSTS: Post[] = parsePosts(postsData as RawPost[]);

// --- Column balancing using real aspect ratios ---
function useMasonryColumns(
  items: Post[],
  columnCount: number,
  columnWidthPx: number = 320
): Post[][] {
  return useMemo(() => {
    const cols: Post[][] = Array.from({ length: columnCount }, () => []);
    const heights: number[] = Array(columnCount).fill(0);

    items.forEach((item) => {
      const shortestCol = heights.indexOf(Math.min(...heights));
      cols[shortestCol].push(item);
      heights[shortestCol] += columnWidthPx / item.aspectRatio;
    });

    return cols;
  }, [items, columnCount, columnWidthPx]);
}

// --- Responsive column count + estimated column width ---
function useColumnLayout(): ColumnLayout {
  const [layout, setLayout] = useState<ColumnLayout>({ count: 4, colWidth: 320 });

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      const gap = 8;
      const padding = 16;
      let count: number;
      if (w < 480) count = 1;
      else if (w < 768) count = 2;
      else if (w < 1100) count = 3;
      else count = 4;

      const colWidth = (w - padding * 2 - gap * (count - 1)) / count;
      setLayout({ count, colWidth });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return layout;
}

// --- Skeleton placeholder that respects aspect ratio ---
function Skeleton({ aspectRatio }: { aspectRatio: number }) {
  return (
    <div
      style={{
        width: "100%",
        paddingBottom: `${(1 / aspectRatio) * 100}%`,
        background: "#1a1a1a",
        backgroundImage: "linear-gradient(90deg, #1a1a1a 25%, #252525 50%, #1a1a1a 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.4s infinite",
      }}
    />
  );
}

// --- Image card ---
interface PostCardProps {
  post: Post;
  onClick: (post: Post) => void;
}

function PostCard({ post, onClick }: PostCardProps) {
  const [loaded, setLoaded] = useState<boolean>(false);
  const [hovered, setHovered] = useState<boolean>(false);

  return (
    <div
      style={{
        ...styles.card,
        transform: hovered ? "scale(1.01)" : "scale(1)",
      }}
      onClick={() => onClick(post)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {!loaded && <Skeleton aspectRatio={post.aspectRatio} />}
      <img
        src={post.thumbUrl}
        alt={post.title}
        onLoad={() => setLoaded(true)}
        style={{ ...styles.img, opacity: loaded ? 1 : 0 }}
      />
      <div style={{ ...styles.overlay, opacity: hovered ? 1 : 0 }}>
        <span style={styles.label}>{post.title}</span>
      </div>
    </div>
  );
}

// --- Lightbox ---
interface LightboxProps {
  post: Post;
  onClose: () => void;
}

function Lightbox({ post, onClose }: LightboxProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div style={styles.lightboxBackdrop} onClick={onClose}>
      <div style={styles.lightboxContent} onClick={(e) => e.stopPropagation()}>
        <img src={post.fullUrl} alt={post.title} style={styles.lightboxImg} />
        <div style={styles.lightboxMeta}>
          <span style={styles.lightboxTitle}>{post.title}</span>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
      </div>
    </div>
  );
}

// --- Main component ---
export default function MasonryGrid() {
  const { count, colWidth } = useColumnLayout();
  const columns = useMasonryColumns(POSTS, count, colWidth);
  const [selected, setSelected] = useState<Post | null>(null);

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      <header style={styles.header}>
        <span style={styles.logo}>scrollify</span>
        <span style={styles.sub}>r/pics · {POSTS.length} posts</span>
      </header>

      <div style={{ ...styles.grid, gridTemplateColumns: `repeat(${count}, 1fr)` }}>
        {columns.map((col, ci) => (
          <div key={ci} style={styles.column}>
            {col.map((post) => (
              <PostCard key={post.id} post={post} onClick={setSelected} />
            ))}
          </div>
        ))}
      </div>

      {selected && <Lightbox post={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

// --- Styles ---
const styles: Record<string, React.CSSProperties> = {
  page: {
    background: "#0e0e0e",
    minHeight: "100vh",
    fontFamily: "'DM Mono', monospace",
    color: "#f0f0f0",
  },
  header: {
    padding: "24px 32px",
    display: "flex",
    alignItems: "baseline",
    gap: "12px",
    borderBottom: "1px solid #222",
    position: "sticky",
    top: 0,
    background: "#0e0e0edd",
    backdropFilter: "blur(8px)",
    zIndex: 10,
  },
  logo: {
    fontSize: "22px",
    fontWeight: "700",
    letterSpacing: "-0.5px",
    color: "#fff",
  },
  sub: {
    fontSize: "13px",
    color: "#555",
    letterSpacing: "0.05em",
  },
  grid: {
    display: "grid",
    gap: "8px",
    padding: "8px",
    alignItems: "start",
  },
  column: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  card: {
    position: "relative",
    borderRadius: "6px",
    overflow: "hidden",
    background: "#1a1a1a",
    cursor: "pointer",
    transition: "transform 0.2s ease",
  },
  img: {
    width: "100%",
    display: "block",
    transition: "opacity 0.3s ease",
  },
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: "32px 10px 10px",
    background: "linear-gradient(transparent, rgba(0,0,0,0.75))",
    transition: "opacity 0.2s ease",
  },
  label: {
    fontSize: "11px",
    color: "#ddd",
    letterSpacing: "0.03em",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  lightboxBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.9)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    padding: "24px",
  },
  lightboxContent: {
    maxWidth: "90vw",
    maxHeight: "90vh",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  lightboxImg: {
    maxWidth: "100%",
    maxHeight: "80vh",
    objectFit: "contain",
    borderRadius: "6px",
  },
  lightboxMeta: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
  },
  lightboxTitle: {
    fontSize: "13px",
    color: "#aaa",
    flex: 1,
  },
  closeBtn: {
    background: "none",
    border: "1px solid #444",
    color: "#aaa",
    borderRadius: "4px",
    padding: "4px 10px",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: "12px",
  },
};