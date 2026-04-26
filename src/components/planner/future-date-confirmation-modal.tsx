import { PlannerModalCard } from "@/components/planner/planner-modal-card";

export function FutureDateConfirmationModal({
  goalTitle,
  onCancel,
  onConfirm,
}: {
  goalTitle: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <PlannerModalCard
      title="Mark as done?"
      subtitle={(
        <>
          <span className="font-semibold">{goalTitle}</span> is scheduled for a future date. Override to mark it done now?
        </>
      )}
      onClose={onCancel}
      actions={[
        { label: "Cancel", onClick: onCancel, variant: "secondary" },
        { label: "Mark done", onClick: onConfirm, variant: "primary" },
      ]}
    />
  );
}
