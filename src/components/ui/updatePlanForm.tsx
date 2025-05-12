"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/redux/store";
import { updateTemplatePlan } from "@/redux/template/templateSlice";

export const UpdatePlanForm = ({ defaultPlan = "FREE", id}: { defaultPlan?: "FREE" | "PAID", id: string}) => {
  const [selectedPlan, setSelectedPlan] = useState<"FREE" | "PAID">(defaultPlan);
  const dispatch = useDispatch<AppDispatch>();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(updateTemplatePlan({id, plan: selectedPlan}))
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
      <div>
        <Label htmlFor="plan">Select your plan</Label>
        <Select value={selectedPlan} onValueChange={(value: "FREE" | "PAID") => setSelectedPlan(value)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose a plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="FREE">Free</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full">
        Update Plan
      </Button>
    </form>
  );
};
