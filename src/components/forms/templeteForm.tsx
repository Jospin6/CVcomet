"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/redux/store";
import { addTemplate } from "@/redux/template/templateSlice";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["CV", "COVER_LETTER"]),
  templateFile: z.any().refine((file) => file instanceof File, "Template file is required"),
});

export default function AddTemplateForm() {
  const [name, setName] = useState("");
  const [type, setType] = useState<"CV" | "COVER_LETTER" | "">("");
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch<AppDispatch>();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validated = schema.parse({ name, type, templateFile });

      const formData = new FormData();
      formData.append("name", validated.name);
      formData.append("type", validated.type);
      formData.append("templateFile", validated.templateFile);

      setLoading(true);

      const res = await dispatch(addTemplate(formData)).unwrap()

    

      if (res) {
        toast.success("Template ajouté avec succès !");
        setName("");
        setType("");
        setTemplateFile(null);
      } else {
        toast.error(`Erreur: lors de l'ajout du template`);
      }
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0]?.message);
      } else {
        toast.error("Erreur inattendue");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Nom du template</Label>
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Entrez le nom du template"
          required
        />
      </div>

      <div>
        <Label>Type de template</Label>
        <Select value={type} onValueChange={(value: "CV" | "COVER_LETTER") => setType(value)}>
          <SelectTrigger>
            <SelectValue placeholder="Choisissez le type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="CV">CV</SelectItem>
            <SelectItem value="COVER_LETTER">Cover Letter</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Image du template</Label>
        <Input
          type="file"
          accept="image/*"
          onChange={(e) => setTemplateFile(e.target.files?.[0] || null)}
          required
        />
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? "Envoi en cours..." : "Ajouter Template"}
      </Button>
    </form>
  );
}
