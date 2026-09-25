"use client";

import React, { Suspense } from "react";
import ChatPage from "@/app/chat/page";

function ArchiveChatPageContent() {
  return <ChatPage initialArchive={true} />;
}

export default function ArchiveChatPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-[#090E17]">
          <div className="w-8 h-8 border-3 border-[#00A884] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ArchiveChatPageContent />
    </Suspense>
  );
}
