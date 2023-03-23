interface Props extends React.HTMLAttributes<HTMLDivElement> {
  maxWidth?: string
  children?: React.ReactNode
}

const Ellipsis = ({ maxWidth = '140px', children, ...props }: Props) => {
  return (
    <div
      {...props}
      style={{
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        maxWidth,
        ...props.style,
      }}
    >
      {children}
    </div>
  )
}

export default Ellipsis
