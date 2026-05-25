"use client";

import { useEffect, useRef } from "react";

interface Props {
  tweetUrl: string;
}

declare global {
  interface Window {
    twttr?: {
      widgets: {
        load: (el?: HTMLElement) => void;
      };
    };
  }
}

export default function TweetEmbed({ tweetUrl }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const load = () => {
      if (window.twttr?.widgets) {
        window.twttr.widgets.load(ref.current ?? undefined);
      }
    };

    if (window.twttr) {
      load();
    } else {
      // Inject Twitter widget script once
      if (!document.querySelector('script[src*="platform.twitter.com/widgets.js"]')) {
        const s = document.createElement("script");
        s.src = "https://platform.twitter.com/widgets.js";
        s.async = true;
        s.charset = "utf-8";
        s.onload = load;
        document.body.appendChild(s);
      } else {
        // Script already in DOM, wait briefly then call load
        const timer = setTimeout(load, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [tweetUrl]);

  return (
    <div ref={ref} className="tweet-embed-wrap">
      <blockquote className="twitter-tweet" data-dnt="true" data-theme="light">
        <a href={tweetUrl}>{tweetUrl}</a>
      </blockquote>
    </div>
  );
}
