"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/redux/store";
import { updateTemplatePlan } from "@/redux/template/templateSlice";
import { toast } from "sonner";

export const UpdatePlanForm = ({
  defaultPlan = "FREE",
  id,
}: {
  defaultPlan?: "FREE" | "PAID";
  id: string;
}) => {
  const [selectedPlan, setSelectedPlan] = useState<"FREE" | "PAID">(defaultPlan);
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch<AppDispatch>();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await dispatch(updateTemplatePlan({ id, plan: selectedPlan }));
      if (updateTemplatePlan.fulfilled.match(result)) {
        toast.success("Template plan updated successfully!");
        window.location.reload();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
      <div>
        <Label htmlFor="plan">Select your plan</Label>
        <Select
          value={selectedPlan}
          onValueChange={(value: "FREE" | "PAID") => setSelectedPlan(value)}
          disabled={loading}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose a plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="FREE">Free</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Updating..." : "Update Plan"}
      </Button>
    </form>
  );
};
