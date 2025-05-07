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
import { transformStringToArray } from "@/lib/utils";
import { UserProfilItem } from "../ui/userProfilItem";
import { useTranslation } from 'react-i18next';

const userSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  linkedin: z.string().optional(),
  portfolio: z.string().optional(),
  skills: z.string().optional(),
  languages: z.string().optional(),
  github: z.string().optional(),
});

type UserFormValues = z.infer<typeof userSchema>;

export default function EditUserForm({ user }: { user?: User }) {
  const { t } = useTranslation();
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
      languages: "",
      github: "",
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
        languages: user.languages,
        github: user.github,
      });
    }
  }, [user, reset]);

  const onSubmit = (data: UserFormValues) => {
    dispatch(updateUser({ id: user?.id ?? "", data }))
    reset()
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="shadow border-[1px] border-gray-500 p-4 rounded-xl w-full">
      <UserProfilItem 
      subTitle={`${t("emailDescription")}`}
      title={`✉️ ${t("email")}`} >
        <InputField
          label=""
          name="email"
          placeholder="example@email.com"
          type="email"
          register={register}
          errors={errors}
        />
      </UserProfilItem>

      <UserProfilItem 
      subTitle={`${t("nameDescription")}`}
      title={`👤 ${t("name")}`} >
        <InputField
          label=""
          name="name"
          placeholder="Your full name"
          register={register}
          errors={errors}
        />
      </UserProfilItem>

      <UserProfilItem 
      subTitle={`${t("phoneDescription")}`}
      title={`📞 ${t("phone")}`} >
        <InputField
          label=""
          name="phone"
          placeholder="+243..."
          register={register}
          errors={errors}
        />
      </UserProfilItem>

      <UserProfilItem 
      subTitle={`${t("addressDescription")}`}
      title={`🏠 ${t("address")}`} >
        <InputField
          label=""
          name="address"
          placeholder="City, Country"
          register={register}
          errors={errors}
        />
      </UserProfilItem>

      <UserProfilItem 
      subTitle={`${t("languageDescription")}`}
      title={`🌐 ${t("languages")}`} >
        <div className="flex flex-wrap gap-2 mb-2">
          {transformStringToArray(user?.languages ?? "").map((language, index) => (
            <div key={index} className="px-5 py-[3px] text-sm rounded-2xl border-[1px] border-gray-500">{language}</div>
          ))}
        </div>
        <InputField
          label=""
          name="languages"
          placeholder="Ex: English, French"
          register={register}
          errors={errors}
        />
      </UserProfilItem>


      <UserProfilItem 
      subTitle={`${t("linkedinDescription")}`}
      title={`🔗 ${t("linkedin")}`} >
        <InputField
          label=""
          name="linkedin"
          placeholder="https://linkedin.com/in/..."
          register={register}
          errors={errors}
        />
      </UserProfilItem>

      <UserProfilItem 
      subTitle={`${t("githubDescription")}`}
      title={`🐙 ${t("github")}`} >
        <InputField
          label=""
          name="github"
          placeholder="jospin6"
          register={register}
          errors={errors}
        />
      </UserProfilItem>

      <UserProfilItem 
      subTitle={`${t("websiteDescription")}`}
      title={`🖼️ ${t("website")}`} >
        <InputField
          label=""
          name="portfolio"
          placeholder="https://yourportfolio.com"
          register={register}
          errors={errors}
        />
      </UserProfilItem>

      <UserProfilItem 
      subTitle={`${t("skillDescription")}`}
      title={`🛠️ ${t("skills")}`} >
        <div className="flex flex-wrap gap-2 mb-2">
          {transformStringToArray(user?.skills ?? "").map((skill, index) => (
            <div key={index} className="px-5 py-[3px] text-sm rounded-2xl border-[1px] border-gray-500">{skill}</div>
          ))}
        </div>
        <TextAreaField
          label=""
          name="skills"
          className="border-[1px] border-gray-500"
          placeholder="List your technical and soft skills"
          register={register}
          errors={errors}
        />
      </UserProfilItem>


      <div className="flex justify-end">
        <Button type="submit">{isSubmitting ? `${t("loading")}` : `${t("saveProfile")}`}</Button>
      </div>
    </form>
  );
}