import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { InputField } from "../ui/InputField";
import { TextAreaField } from "../ui/textAreaField";
import { Button } from "../ui/button";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/redux/store";
import { updateUser, User } from "@/redux/user/userSlice";
import { useEffect } from "react";

const userSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  linkedin: z.string().optional(),
  portfolio: z.string().optional(),
  skills: z.string().optional(),
});

type UserFormValues = z.infer<typeof userSchema>;

export default function EditUserForm({ user }: { user?: User }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      email: "",
      name: "",
      phone: "",
      address: "",
      linkedin: "",
      portfolio: "",
      skills: "",
    }
  });
  const dispatch = useDispatch<AppDispatch>()
  useEffect(() => {
    if (user) {
      reset({
        email: user.email,
        name: user.name,
        phone: user.phone,
        address: user.address,
        linkedin: user.linkedin,
        portfolio: user.portfolio,
        skills: user.skills,
      });
    }
  }, [user, reset]);

  const onSubmit = (data: UserFormValues) => {
    dispatch(updateUser({ id: user?.id ?? "", data }))
    reset()
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="border border-gray-700 p-4 rounded-xl w-full">
      <InputField
        label="Email"
        className="text-gray-800"
        name="email"
        placeholder="example@email.com"
        type="email"
        register={register}
        errors={errors}
      />
      <InputField
        label="Name"
        name="name"
        className="text-gray-800"
        placeholder="Your full name"
        register={register}
        errors={errors}
      />
      <InputField
        label="Phone"
        name="phone"
        placeholder="+243..."
        className="text-gray-800"
        register={register}
        errors={errors}
      />
      <InputField
        label="Address"
        name="address"
        className="text-gray-800"
        placeholder="City, Country"
        register={register}
        errors={errors}
      />
      <InputField
        label="LinkedIn"
        name="linkedin"
        className="text-gray-800"
        placeholder="https://linkedin.com/in/..."
        register={register}
        errors={errors}
      />
      <InputField
        label="Portfolio"
        name="portfolio"
        className="text-gray-800"
        placeholder="https://yourportfolio.com"
        register={register}
        errors={errors}
      />

      <TextAreaField
        label="Skills"
        name="skills"
        className="text-gray-800"
        placeholder="List your technical and soft skills"
        register={register}
        errors={errors}
      />
      <div className="flex justify-end">
        <Button type="submit">{isSubmitting ? "Saving..." : "Save Profile"}</Button>
      </div>
    </form>
  );
}
