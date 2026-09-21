import { Feature, useFlag, useFlagEvaluation } from '../flags'
import './FlagDemo.css'

/** Small showcase of the three ways product code reads a flag. */
export function FlagDemo() {
  const layout = useFlag('checkoutLayout')
  const limit = useFlag('searchResultLimit')
  const checkout = useFlagEvaluation('newCheckout')

  return (
    <section className="flag-demo">
      <h2>Feature flags</h2>

      <Feature flag="betaBanner">
        <p className="flag-demo__banner">
          You are on the beta build. Toggle <code>betaBanner</code> in the Flags
          panel to hide this.
        </p>
      </Feature>

      <dl className="flag-demo__grid">
        <div>
          <dt>
            <code>newCheckout</code> — hook + evaluation reason
          </dt>
          <dd>
            {checkout.value ? 'new checkout' : 'legacy checkout'}{' '}
            <span className="flag-demo__reason">
              ({checkout.reason}
              {checkout.bucket !== undefined
                ? `, bucket ${checkout.bucket}`
                : ''}
              )
            </span>
          </dd>
        </div>

        <div>
          <dt>
            <code>checkoutLayout</code> — multivariate
          </dt>
          <dd>{layout}</dd>
        </div>

        <div>
          <dt>
            <code>searchResultLimit</code> — numeric config
          </dt>
          <dd>{limit} results per page</dd>
        </div>
      </dl>

      <Feature
        flag="checkoutLayout"
        equals="minimal"
        fallback={
          <p className="flag-demo__note">
            Pick the <code>minimal</code> layout to swap this paragraph.
          </p>
        }
      >
        <p className="flag-demo__note">
          Minimal layout active — rendered via <code>&lt;Feature equals&gt;</code>.
        </p>
      </Feature>
    </section>
  )
}
