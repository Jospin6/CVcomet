import { useForm } from "react-hook-form";
import { InputField } from "../ui/InputField";
import { Button } from "../ui/button";
import { TextAreaField } from "../ui/textAreaField";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from 'react-i18next';

// Définir le schéma de validation
const certificationSchema = z.object({
  name: z.string().min(1, "Certification name is required"),
  organization: z.string().min(1, "Organization is required"),
  date: z.string().min(1, "Date is required"),
});

type CertificationFormValues = z.infer<typeof certificationSchema>;

export default function CertificationForm() {
  const { t } = useTranslation();
  const { register, handleSubmit, formState: { errors } } = useForm<CertificationFormValues>({
    resolver: zodResolver(certificationSchema),
  });

  const onSubmit = (data: CertificationFormValues) => {
    console.log("Form Data:", data);
    // Ici, vous pouvez envoyer les données au backend ou les stocker
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="border border-gray-500 p-3 rounded-2xl">
      <InputField
        label={`${t("certificatName")}`}
        name="name"
        placeholder="Enter certification name"
        register={register}
        errors={errors}
      />

      <InputField
        label="Organization"
        name="organization"
        placeholder="Enter organization name"
        register={register}
        errors={errors}
      />

      <InputField
        label="Date"
        name="date"
        type="date"
        placeholder="Enter certification date"
        register={register}
        errors={errors}
      />

      <div className="flex justify-end my-4">
        <Button type="submit">{`${t("addCertificat")}`}</Button>
      </div>
    </form>
  );
}
