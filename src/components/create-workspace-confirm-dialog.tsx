"use client";

import { useRouter } from "next/navigation";
import { Modal } from "@/components/modal";
import { Button } from "@/components/button";

interface Props {
  open: boolean;
  onClose: () => void;
  currentWorkspaceName?: string;
}

export function CreateWorkspaceConfirmDialog({ open, onClose, currentWorkspaceName }: Props) {
  const router = useRouter();

  function handleContinue() {
    onClose();
    router.push("/onboarding/workspace?new=true");
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create a new workspace?"
      size="md"
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleContinue}>Continue</Button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-[var(--foreground)]">
        <p>
          You&apos;ll go through onboarding for the new workspace — company info, chart of accounts,
          team, and more.
        </p>
        <p>
          Your current workspace
          {currentWorkspaceName ? <> <b>{currentWorkspaceName}</b></> : ""} stays untouched — switch
          back anytime via the workspace switcher, and use &quot;Finish later&quot; to pause.
        </p>
      </div>
    </Modal>
  );
}
