"use client"
import EditUserForm from "@/components/forms/editUserForm";
import EducationForm from "@/components/forms/educationForm";
import ExperienceForm from "@/components/forms/experienceForm";
import ProjectForm from "@/components/forms/projectForm";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { AppDispatch } from "@/redux/store";
import { fetchUser } from "@/redux/user/userSlice";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";


export default function Profil() {
    const dispatch = useDispatch<AppDispatch>()
    const currentUser = useCurrentUser()
    const user = useSelector((state: any) => state.user.user)
    const loading = useSelector((state: any) => state.user.loading)

    useEffect(() => {
        if (currentUser?.id) {
            dispatch(fetchUser(currentUser.id))
        }
    }, [currentUser?.id, dispatch])

    return <div className="w-full text-gray-800">
        <div className="mt-3">
            <EditUserForm user={user} />
        </div>
        <div className="mt-3">
            <ExperienceForm user={user}  />
        </div>
        <div className="mt-3">
            <EducationForm user={user} />
        </div>
        <div className="mt-3">
            <ProjectForm user={user}  />
        </div>
    </div>
}