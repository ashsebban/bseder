import type { Goal } from "@/features/goals/types/goal";
import type { Milestone } from "@/features/goals/types/goal";
import { ProjectGoalCard } from "@/features/goals/components/project-goal-card";

interface ProjectGoalsViewProps {
  directGoals: Goal[];
  goals: Goal[];
  handleUpdateProgress: (id: string, newValue: number) => void;
  handleUpdateMilestones: (id: string, milestones: Milestone[]) => void;
  handleSave: (goal: Goal) => void;
  handleEdit: (goal: Goal) => void;
  handleDelete: (id: string) => void;
}

export function ProjectGoalsView({
  directGoals,
  goals,
  handleUpdateProgress,
  handleUpdateMilestones,
  handleSave,
  handleEdit,
  handleDelete,
}: ProjectGoalsViewProps) {
  const projects = directGoals.filter((g) => !g.adhoc);
  
  if (projects.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-text-subtle">
        No projects yet. Create one to track long-term goals with milestones.
      </p>
    );
  }

  return (
    <>
      <h3 className="mb-3 text-base font-semibold text-text">Projects</h3>
      <div className="space-y-3">
        {projects.map((goal) => {
          const childGoal = goals.find(
            (g) => g.parentGoalId === goal.id && g.cadence !== "one-time",
          );
          return (
            <ProjectGoalCard
              key={goal.id}
              goal={goal}
              childGoal={childGoal}
              onUpdateProgress={handleUpdateProgress}
              onUpdateMilestones={handleUpdateMilestones}
              onSaveChildGoal={handleSave}
              onEdit={() => handleEdit(goal)}
              onDelete={() => handleDelete(goal.id)}
            />
          );
        })}
      </div>
    </>
  );
}
