import * as React from "react";

export const EmailTemplate = ({ code }: { code: string }) => {
    return (
        <div
            style={{
                fontFamily: "Arial, sans-serif",
                backgroundColor: "#f9f9f9",
                padding: "20px",
            }}
        >
            <div
                style={{
                    maxWidth: "600px",
                    margin: "0 auto",
                    backgroundColor: "#ffffff",
                    borderRadius: "8px",
                    padding: "30px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                }}
            >
                <h1 style={{ color: "#111827", fontSize: "24px", marginBottom: "16px" }}>
                    Bienvenue sur notre plateforme !
                </h1>

                <p style={{ fontSize: "16px", color: "#374151", marginBottom: "24px" }}>
                    Merci de vous être inscrit. Afin d’activer votre compte et commencer à
                    utiliser nos services, veuillez entrer le code de vérification ci-dessous :
                </p>

                <div
                    style={{
                        backgroundColor: "#f3f4f6",
                        borderRadius: "6px",
                        padding: "16px",
                        textAlign: "center",
                        fontSize: "20px",
                        fontWeight: "bold",
                        letterSpacing: "2px",
                        color: "#1d4ed8",
                        marginBottom: "24px",
                    }}
                >
                    {code}
                </div>

                <p style={{ fontSize: "14px", color: "#6b7280" }}>
                    Merci et à bientôt,
                    <br />
                    <strong>L’équipe Support</strong>
                </p>
            </div>
        </div>
    );
};
