"use client";

import { Pause, Play, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

import { useReelDirector } from "./autopilot";

export function ReelControls() {
  const { isPaused, togglePause, restart } = useReelDirector();
  return (
    <div className="mt-4 flex items-center justify-center gap-2">
      <Button variant="ghost" size="sm" onClick={togglePause}>
        {isPaused ? (
          <>
            <Play className="size-3" />
            Resume
          </>
        ) : (
          <>
            <Pause className="size-3" />
            Pause
          </>
        )}
      </Button>
      <Button variant="ghost" size="sm" onClick={restart}>
        <RotateCcw className="size-3" />
        Restart
      </Button>
    </div>
  );
}
