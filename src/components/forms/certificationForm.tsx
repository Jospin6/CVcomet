import { useForm } from "react-hook-form";
import { InputField } from "../ui/InputField";
import { Button } from "../ui/button";
import { TextAreaField } from "../ui/textAreaField";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from 'react-i18next';
import { User } from "@/redux/user/userSlice";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/redux/store";
import { addCertification } from "@/redux/certification/certificationSlice";
import { useState } from "react";
import { toast } from "sonner";

// Définir le schéma de validation
const certificationSchema = z.object({
  name: z.string().min(1, "Certification name is required"),
  organization: z.string().min(1, "Organization is required"),
  date: z.string().min(1, "Date is required"),
  description: z.string().optional()
});

type CertificationFormValues = z.infer<typeof certificationSchema>;

export default function CertificationForm({ user }: { user?: User }) {
  const { t } = useTranslation();
  const { register, reset, handleSubmit, formState: { errors, isSubmitting } } = useForm<CertificationFormValues>({
    resolver: zodResolver(certificationSchema),
  });
  const dispatch = useDispatch<AppDispatch>()
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const onSubmit = async (data: CertificationFormValues) => {
  
    if (!user?.id) {
      setSuccessMessage(null);
      toast.error("Échec de l'ajout de la certification.");
      return;
    }

    try {
      const resultAction = await dispatch(addCertification({ userId: user.id, ...data }));

      if (addCertification.fulfilled.match(resultAction)) {
        setSuccessMessage("Certification added successfully!");
        reset();
        toast.success("Certification ajoutée avec succès !");
        window.location.reload(); // Si ce reload est nécessaire
      } else {
        setSuccessMessage(null);
        toast.error("Échec de l'ajout de la certification.");
      }
    } catch (error) {
      setSuccessMessage(null);
      toast.error("Échec de l'ajout de la certification.");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="border border-gray-500 p-3 rounded-2xl">
      {successMessage ? (
        <div className="bg-green-100 text-green-800 px-4 py-2 rounded-md">
          {successMessage}
        </div>
      ): (<div className="text-center text-red-400 bg-red-900 rounded-xl">Error</div>)}
      <div className="md:grid md:grid-cols-6 gap-4">
        <InputField
          label={`${t("certificatName")}`}
          className="col-span-2"
          name="name"
          placeholder="Enter certification name"
          register={register}
          errors={errors}
        />

        <InputField
          label="Organization"
          className="col-span-2"
          name="organization"
          placeholder="Enter organization name"
          register={register}
          errors={errors}
        />

        <InputField
          label="Date"
          className="col-span-2"
          name="date"
          type="date"
          placeholder="Enter certification date"
          register={register}
          errors={errors}
        />
      </div>

      <div>
        <TextAreaField
          label={"Description"}
          name={"description"}
          placeholder={"What did you learn as education"}
          register={register}
          errors={errors} />
      </div>

      <div className="flex justify-end my-4">
        <Button type="submit">{isSubmitting ? `${t("loading")}` : `${t("addCertificat")}`}</Button>
      </div>
    </form>
  );
}
