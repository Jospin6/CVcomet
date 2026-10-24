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
import { marketProfiles, resumeMarkets, type ResumeMarket } from "@/lib/resume-market";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["CV", "COVER_LETTER"]),
  templateFile: z.any().refine((file) => file instanceof File, "Template file is required"),
});

export default function AddTemplateForm() {
  const [name, setName] = useState("");
  const [type, setType] = useState<"CV" | "COVER_LETTER" | "">("");
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [markets, setMarkets] = useState<ResumeMarket[]>([]);
  const [styleFamily, setStyleFamily] = useState("MODERN");
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch<AppDispatch>();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validated = schema.parse({ name, type, templateFile });
      if (validated.templateFile.size > 2 * 1024 * 1024) {
        toast.error("L'image doit être inférieure à 2 Mo.");
        return;
      }

      const formData = new FormData();
      formData.append("name", validated.name);
      formData.append("type", validated.type);
      formData.append("templateFile", validated.templateFile);
      formData.append("markets", markets.join(","));
      formData.append("styleFamily", styleFamily);

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
        <Label>Style</Label>
        <Select value={styleFamily} onValueChange={setStyleFamily}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["MODERN","CLASSIC","MINIMAL","EXECUTIVE","TECHNICAL","EUROPASS_INSPIRED"].map(v => <SelectItem key={v} value={v}>{v.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select>
      </div>
      <div className="space-y-2"><Label>Marchés compatibles</Label><p className="text-xs text-muted-foreground">Aucun marché sélectionné = template universel.</p><div className="grid gap-2 sm:grid-cols-2">{resumeMarkets.map(id => <label key={id} className="flex items-center gap-2 rounded-lg border p-3 text-sm"><input type="checkbox" checked={markets.includes(id)} onChange={e => setMarkets(current => e.target.checked ? [...current, id] : current.filter(x => x !== id))}/>{marketProfiles[id].shortLabel}</label>)}</div></div>
      <div>
        <Label>Image du template</Label>
        <Input
          type="file"
          accept="image/png,image/jpeg,image/webp"
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
