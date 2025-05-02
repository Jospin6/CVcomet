
import { useForm } from "react-hook-form";
import { InputField } from "../ui/InputField";
import { Button } from "../ui/button";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { User } from "@/redux/user/userSlice";
import { useState } from "react";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/redux/store";
import { addProject } from "@/redux/project/projectSlice";

const projectSchema = z.object({
  start: z.string().min(1, "Start date is required"),
  end: z.string().optional(),
  title: z.string().min(1, "Project title is required"),
  url: z.string().url("Enter a valid URL").min(1, "Project URL is required"),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

export default function ProjectForm({ user }: { user?: User }) {
  const dispatch = useDispatch<AppDispatch>()
  const { register, reset, handleSubmit, formState: { errors } } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
  });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const onSubmit = async (data: ProjectFormValues) => {
    console.log("Form Data:", data);
    try {
      if (!user?.id) {
        console.log("User ID is missing");
        return;
      }
      await dispatch(addProject({ userId: user.id, ...data }));
      setSuccessMessage("Education added successfully!");
      reset();
    } catch (err) {
      console.log(err);
      setSuccessMessage(null);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="border border-gray-700 p-3 rounded-2xl">
      {successMessage && (
        <div className="bg-green-100 text-green-800 px-4 py-2 rounded-md">
          {successMessage}
        </div>
      )}
      <div className="grid grid-cols-8 gap-4">
        <InputField
          label="Start Date"
          className="col-span-2"
          name="start"
          placeholder="YYYY-MM-DD"
          type="date"
          register={register}
          errors={errors}
        />
        <InputField
          label="End Date"
          className="col-span-2"
          name="end"
          placeholder="YYYY-MM-DD (optional)"
          type="date"
          register={register}
          errors={errors}
        />
        <InputField
          label="Project Title"
          className="col-span-2"
          name="title"
          placeholder="Enter project title"
          register={register}
          errors={errors}
        />

        <InputField
          label="Project URL"
          className="col-span-2"
          type="url"
          name="url"
          placeholder="Enter project URL"
          register={register}
          errors={errors}
        />
      </div>
      <div className="flex justify-end my-4">
        <Button type="submit">Save Project</Button>
      </div>
    </form>
  );
}
