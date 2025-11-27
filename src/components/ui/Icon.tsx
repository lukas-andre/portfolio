import {
  Mail,
  Linkedin,
  Github,
  FolderOpen,
  Play,
  Info,
  Sparkles,
  Terminal,
  Cpu,
  Brain,
  Award,
  ScrollText,
  type LucideIcon,
} from 'lucide-react';

const icons: Record<string, LucideIcon> = {
  mail: Mail,
  linkedin: Linkedin,
  github: Github,
  folder: FolderOpen,
  play: Play,
  info: Info,
  sparkles: Sparkles,
  terminal: Terminal,
  cpu: Cpu,
  brain: Brain,
  award: Award,
  scroll: ScrollText,
};

interface IconProps {
  name: keyof typeof icons;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export default function Icon({ name, size = 20, className = '', strokeWidth = 1.5 }: IconProps) {
  const IconComponent = icons[name];

  if (!IconComponent) {
    return null;
  }

  return (
    <IconComponent
      size={size}
      className={className}
      strokeWidth={strokeWidth}
    />
  );
}
