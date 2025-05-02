import {Menu} from 'lucide-react'
export const Navbar = () => {
    return <div className="w-full h-64 border-b flex justify-between items-center">
        <div>My CV</div>
        <div><Menu size={24}/></div>
    </div>
}