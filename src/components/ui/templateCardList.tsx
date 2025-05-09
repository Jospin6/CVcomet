"use client";
import { User } from "@/redux/user/userSlice";
import { TemplateItem } from "./templateItem";

type Template = {
  id: string;
  name: string;
  type: "CV" | "COVER_LETTER";
  templateFile: string; // URL ou base64 image
  createdAt: string;
};

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
