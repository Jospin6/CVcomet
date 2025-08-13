"use client";

import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from 'react-i18next';
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { AppDispatch, RootState } from "@/redux/store";
import { fetchUser } from "@/redux/user/userSlice";
import EditUserForm from "@/components/forms/editUserForm";
import EducationForm from "@/components/forms/educationForm";
import ExperienceForm from "@/components/forms/experienceForm";
import ProjectForm from "@/components/forms/projectForm";
import CertificationForm from "@/components/forms/certificationForm";
import { Button } from "@/components/ui/button";

// Enumération des étapes de l'onboarding
const ONBOARDING_STEPS = {
  USER_INFO: 0,
  EXPERIENCE: 1,
  EDUCATION: 2,
  PROJECTS: 3,
  CERTIFICATIONS: 4,
  COMPLETED: 5
} as const;

export default function OnboardingProfil() {
    const { t } = useTranslation();
    const dispatch = useDispatch<AppDispatch>();
    const currentUser = useCurrentUser();
    const user = useSelector((state: RootState) => state.user.user);
    const [currentStep, setCurrentStep] = useState<number>(ONBOARDING_STEPS.USER_INFO);
    const hasFetched = useRef(false);

    useEffect(() => {
        if (currentUser?.id && !hasFetched.current) {
            dispatch(fetchUser(currentUser.id));
            hasFetched.current = true;
        }
    }, [currentUser?.id]);

    const handleNextStep = () => {
        setCurrentStep(prev => prev + 1);
    };

    const handlePreviousStep = () => {
        setCurrentStep(prev => prev - 1);
    };

    const renderCurrentStep = () => {
        switch (currentStep) {
            case ONBOARDING_STEPS.USER_INFO:
                return (
                    <div className="mt-3">
                        <div className="text-lg font-bold mb-3">{t("userInfos")}</div>
                        <EditUserForm 
                            user={user || undefined} 
                            onSuccess={handleNextStep}
                        />
                    </div>
                );
            case ONBOARDING_STEPS.EXPERIENCE:
                return (
                    <div className="mt-3">
                        <div className="text-lg font-bold">{t("experience")}</div>
                        <ExperienceForm 
                            user={user || undefined}
                            onSuccess={handleNextStep}
                        />
                    </div>
                );
            case ONBOARDING_STEPS.EDUCATION:
                return (
                    <div className="mt-3">
                        <div className="text-lg font-bold">{t("education")}</div>
                        <EducationForm 
                            user={user || undefined}
                            onSuccess={handleNextStep}
                        />
                    </div>
                );
            case ONBOARDING_STEPS.PROJECTS:
                return (
                    <div className="mt-3">
                        <div className="text-lg font-bold">{t("projects")}</div>
                        <ProjectForm 
                            user={user || undefined}
                            onSuccess={handleNextStep}
                        />
                    </div>
                );
            case ONBOARDING_STEPS.CERTIFICATIONS:
                return (
                    <div className="mt-3 mb-6">
                        <div className="text-lg font-bold">{t("certificationss")}</div>
                        <CertificationForm 
                            user={user || undefined}
                            onSuccess={handleNextStep}
                        />
                    </div>
                );
            case ONBOARDING_STEPS.COMPLETED:
                return (
                    <div className="mt-10 text-center">
                        <h2 className="text-2xl font-bold mb-4">{t("onboardingComplete")}</h2>
                        <p>{t("onboardingCompleteMessage")}</p>
                        <Button className="mt-6" onClick={() => window.location.href = '/dashboard'}>
                            {t("goToDashboard")}
                        </Button>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="w-full text-gray-200 max-w-3xl mx-auto p-4">
            {/* Barre de progression */}
            <div className="mb-8">
                <div className="flex justify-between mb-2">
                    {Object.values(ONBOARDING_STEPS)
                        .filter(step => typeof step === 'number' && step < ONBOARDING_STEPS.COMPLETED)
                        .map((step) => (
                            <div 
                                key={step} 
                                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                    currentStep >= step 
                                        ? 'bg-primary text-white' 
                                        : 'bg-gray-200 text-gray-600'
                                }`}
                            >
                                {step + 1}
                            </div>
                        ))}
                </div>
                <div className="w-full bg-gray-200 h-2 rounded-full">
                    <div 
                        className="bg-primary h-2 rounded-full transition-all duration-300" 
                        style={{
                            width: `${(currentStep / (ONBOARDING_STEPS.COMPLETED - 1)) * 100}%`
                        }}
                    />
                </div>
            </div>

            {/* Formulaire actuel */}
            {renderCurrentStep()}

            {/* Boutons de navigation (sauf pour la dernière étape) */}
            {currentStep < ONBOARDING_STEPS.COMPLETED && (
                <div className="flex justify-between mt-8">
                    <Button
                        variant="outline"
                        onClick={handlePreviousStep}
                        disabled={currentStep === ONBOARDING_STEPS.USER_INFO}
                    >
                        {t("previous")}
                    </Button>
                    
                    {/* Le bouton suivant est géré dans chaque formulaire via onSuccess */}
                </div>
            )}
        </div>
    );
}