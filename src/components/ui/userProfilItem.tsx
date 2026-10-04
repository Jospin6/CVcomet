
export const UserProfilItem = ({ title, subTitle, icon, children }: { icon?: React.ReactElement, title: string, subTitle?: string, children: React.ReactNode }) => {
    return <div className="md:grid md:grid-cols-4 border-b-[1px] border-border gap-4 py-3 mb-4">
        <div className="col-span-2 min-w-0">
            <div className="text-sm text-foreground font-bold flex items-center">
                {icon && <>{icon} &nbsp;</>}
                {title}
            </div>
            <div className="text-[12px] text-muted-foreground">{subTitle}</div>
        </div>
        <div className="col-span-2 min-w-0">
            {children}
        </div>
    </div>
}