
import { useForm } from "react-hook-form";
import { InputField } from "../ui/InputField";
import { Button } from "../ui/button";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { User } from "@/redux/user/userSlice";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/redux/store";
import { useTranslation } from 'react-i18next';
import { addProject, updateProject } from "@/redux/project/projectSlice";
import { TextAreaField } from "../ui/textAreaField";
import { toast } from "sonner";

const projectSchema = z.object({
  start: z.string().min(1, "Start date is required"),
  end: z.string().optional(),
  title: z.string().min(1, "Project title is required"),
  url: z.string().optional(),
  description: z.string().optional(),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

export default function ProjectForm({ user, initialData, id, onSuccess }: { id?: string, onSuccess?: () => void, user?: User, initialData?: ProjectFormValues }) {
  const { t } = useTranslation();
  const dispatch = useDispatch<AppDispatch>()
  const { register, reset, handleSubmit, formState: { errors, isSubmitting } } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      title: "",
      url: "",
      start: "",
      end: "",
      description: "",
    }
  });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  useEffect(() => {
    if (initialData) {
      reset({
        title: initialData.title,
        url: initialData.url,
        start: initialData.start,
        end: initialData.end,
        description: initialData.description,
      });
    }
  }, [initialData, reset]);

  const onSubmit = async (data: ProjectFormValues) => {
    try {
      if (!user?.id) {
        toast.error("User ID is missing");
        return;
      }

      let result;
      if (!initialData) {
        result = await dispatch(addProject({ userId: user.id, ...data }));
      } else {
        if (id) {
          result = await dispatch(updateProject({ userId: user.id, ...data, id }));
        }
      }

      if (addProject.fulfilled.match(result) || updateProject.fulfilled.match(result)) {
        toast.success("Project added or updated successfully!");
        if (onSuccess) {
          onSuccess()
        }
        reset();
      } else {
        toast.error("Failed to add or update project. Please try again.");
      }
    } catch (err) {
      toast.error("An unexpected error occurred.");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="border-[1px] border-gray-500 shadow p-3 rounded-2xl">
      {successMessage && (
        <div className="bg-green-100 text-green-800 px-4 py-2 rounded-md">
          {successMessage}
        </div>
      )}
      <div className="md:grid md:grid-cols-6 gap-4">
        <InputField
          label={`${t("start")}`}
          className="col-span-2"
          name="start"
          placeholder="YYYY-MM-DD"
          type="date"
          register={register}
          errors={errors}
        />
        <InputField
          label={`${t("end")}`}
          className="col-span-2"
          name="end"
          placeholder="YYYY-MM-DD (optional)"
          type="date"
          register={register}
          errors={errors}
        />
        <InputField
          label={`${t("projectName")}`}
          className="col-span-2"
          name="title"
          placeholder="Enter project title"
          register={register}
          errors={errors}
        />

        {/* <InputField
          label={`${t("url")}`}
          className="col-span-2"
          type="url"
          name="url"
          placeholder="Enter project URL"
          register={register}
          errors={errors}
        /> */}
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
        <Button type="submit">{isSubmitting ? `${t("loading")}` : `${t("addProject")}`}</Button>
      </div>
    </form>
  );
}
