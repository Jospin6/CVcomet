"use client";
import { User } from "@/redux/user/userSlice";
import { TemplateItem } from "./templateItem";
import { Template } from "@/redux/template/templateSlice";

type TemplateCardListProps = {
  templates: Template[];
  user?: User
};

export default function TemplateCardList({ templates, user }: TemplateCardListProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
      {templates.map((template) => (
        <TemplateItem key={template.id} template={template} user={user} />
      ))}
    </div>
  );
}
