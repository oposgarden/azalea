import { Copy, Lock, Unlock, Check } from '@geist-ui/icons'

interface LockStatusProps {
  fund: Fund
}

const LockStatus = ({ fund }: LockStatusProps) => {
  return (
    <div style={{ position: 'absolute', right: '18px', top: '18px' }}>
      {fund.currentAmount.uiAmount == 0 ? (
        <Check color="green" />
      ) : new Date(fund.redeemTimestamp * 1000) < new Date() ? (
        <Unlock color="green" />
      ) : (
        <Lock color="orange" />
      )}
    </div>
  )
}
export default LockStatus
