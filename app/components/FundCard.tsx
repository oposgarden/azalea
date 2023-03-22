import { useEffect, useState } from 'react'
import Link from 'next/link'
import copy from 'copy-to-clipboard'
import { Card, Text, Spacer, Description, useToasts } from '@geist-ui/core'
import { Copy, Lock, Unlock, Check } from '@geist-ui/icons'
import { TokenListProvider, TokenInfo, ENV } from '@solana/spl-token-registry'

const FundCard = ({ fund }: { fund: any }) => {
  const { setToast } = useToasts()

  const [token, setToken] = useState<TokenInfo | null>(null)

  useEffect(() => {
    new TokenListProvider().resolve().then(tokens => {
      const tokenList = tokens
        .filterByChainId(parseInt(process.env.NEXT_PUBLIC_CHAIN_ID as string) || ENV.Devnet)
        .getList()

      const token = tokenList.filter(token => {
        return token.address == fund.mint.toString()
      })?.[0]

      setToken(token)
    })
  }, [setToken, fund])

  return (
    <Card
      hoverable
      width="100%"
      marginBottom="20px"
      key={fund.address.toString()}
      style={{ position: 'relative' }}
    >
      <div style={{ position: 'absolute', right: '18px', top: '18px' }}>
        {fund.currentAmount.uiAmount == 0 ? (
          <Check color="green" />
        ) : new Date(fund.redeemTimestamp * 1000) < new Date() ? (
          <Unlock color="green" />
        ) : (
          <Lock color="orange" />
        )}
      </div>
      <Link
        href={`${
          process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
        }/fund/${fund.address.toString()}`}
        passHref
      >
        <a>
          <Text h4 my={0}>
            {new Date(fund.redeemTimestamp * 1000) < new Date() ? 'Unlocked fund' : 'Locked fund'}
          </Text>
        </a>
      </Link>
      <Spacer h={1} />
      <Description
        title="Amount"
        content={`${fund.currentAmount.uiAmountString} (${token?.symbol})`}
      />
      <Spacer h={1} />
      <Description
        title="Redeemer"
        content={
          <div
            style={{
              cursor: 'pointer',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              maxWidth: '140px',
            }}
            onClick={() => {
              copy(fund.address.toString())
              setToast({ text: 'Redeemer address copied', delay: 2000 })
            }}
          >
            {fund.redeemer.toString()}
          </div>
        }
      />
      <Spacer h={1} />
      <Description
        title="Redeem time"
        content={new Date(fund.redeemTimestamp * 1000).toLocaleString()}
      />
      <Card.Footer>
        <div
          style={{
            cursor: 'pointer',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            maxWidth: '260px',
          }}
          onClick={() => {
            copy(
              `${
                process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
              }/fund/${fund.address.toString()}`,
            )
            setToast({ text: 'Fund link copied', delay: 2000 })
          }}
        >
          Share fund <Copy size="12px" />
        </div>
      </Card.Footer>
    </Card>
  )
}

export default FundCard
